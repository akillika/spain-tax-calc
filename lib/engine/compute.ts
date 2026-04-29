import {
  ALL_RULES,
  RULES_VERSION,
  equivalenceSurchargeFor,
} from "@/lib/rules/iva";
import { determinePlaceOfSupply, EU_COUNTRIES } from "./place-of-supply";
import { determineTaxAuthority, determineTaxCode } from "./determine-tax";
import { resolveRule } from "./rate-resolver";
import { computeExcise } from "./excise";
import { computeIedmt } from "./iedmt";
import type {
  AppliedRule,
  CalculationResult,
  CalculationTotals,
  Line,
  LineResult,
  Transaction,
  Treatment,
} from "./types";

const PROMPT_VERSION = "classifier-v1";

/**
 * Main entry point. Pure function: same Transaction + same rules = same result.
 *
 * Caller is responsible for AI classification *before* invoking calculate().
 * Each line should have `hints` populated (or an empty object). The rule set
 * uses hints to decide which dated rule applies.
 */
export function calculate(tx: Transaction): CalculationResult {
  const lineResults: LineResult[] = tx.lines.map((line) =>
    calculateLine(tx, line),
  );

  const totals = aggregateTotals(lineResults);

  const invoiceMentions = dedupe(
    lineResults.flatMap((lr) =>
      lr.appliedRules.flatMap((ar) =>
        // We don't carry the rule's invoiceMention separately on AppliedRule (yet);
        // it surfaces via warnings when needed. Curated rules expose mention in result.
        [],
      ),
    ),
  );

  // Walk lines a second time to harvest mentions from the rule set (we re-resolve quickly).
  for (const lr of lineResults) {
    for (const ar of lr.appliedRules) {
      const rule = ALL_RULES.find((r) => r.id === ar.ruleId);
      if (rule?.result.invoiceMention) {
        if (!invoiceMentions.includes(rule.result.invoiceMention)) {
          invoiceMentions.push(rule.result.invoiceMention);
        }
      }
    }
  }

  // Top-level warnings (collected from each line + transaction-wide checks).
  const warnings = [
    ...new Set(lineResults.flatMap((lr) => lr.warnings)),
    ...transactionLevelWarnings(tx),
  ];

  // Tax authority is determined by the first taxable line's place of supply.
  // (MVP simplification — real foral pro-rata would happen at the seller level.)
  const referencePlace =
    lineResults[0]?.placeOfSupply ?? {
      country: tx.seller.country,
      region: tx.seller.region,
      jurisdiction: "ES.mainland" as const,
      reason: "default",
    };
  const taxAuthority = determineTaxAuthority(tx, referencePlace);

  return {
    fingerprint: fingerprintTransaction(tx),
    rulesVersion: RULES_VERSION,
    promptVersion: PROMPT_VERSION,
    taxAuthority,
    lines: lineResults,
    totals,
    invoiceMentions,
    warnings,
  };
}

function calculateLine(tx: Transaction, line: Line): LineResult {
  const warnings: string[] = [];
  const place = determinePlaceOfSupply(tx, line);
  const taxCode = determineTaxCode(place);

  const net = round2(line.quantity * line.unitPriceNet);
  const discounted = applyDiscount(net, line);

  // IIEE — added to taxable base for IVA per Art. 78.Dos.4.º LIVA.
  const exciseResult = computeExcise(line, tx.operationDate);
  const taxableBase = round2(discounted + (exciseResult?.amount ?? 0));

  // IEDMT — separate from IVA, computed on the vehicle base.
  const iedmtResult = computeIedmt(line, place.region);

  // Default: not subject (place of supply outside Spain).
  if (taxCode === "NONE") {
    return {
      description: line.description,
      category: line.category,
      net,
      taxableBase,
      taxCode: "NONE",
      ratePercent: 0,
      taxAmount: 0,
      treatment: "not_subject",
      placeOfSupply: place,
      appliedRules: [
        {
          ruleId: "engine.not_subject_outside_spain",
          effectiveFrom: "1993-01-01",
          source: ["Ley 37/1992 Art. 4"],
          reasoning: `Place of supply is ${place.jurisdiction} — outside Spanish indirect-tax scope.`,
        },
      ],
      warnings: [
        ...(EU_COUNTRIES[tx.buyer.country]
          ? ["Customer is in another EU member state — buyer's local VAT (or reverse charge) applies. Consider OSS if B2C."]
          : ["Sale outside EU — verify export documentation (DUA) for zero-rating proof."]),
      ],
      total: round2(taxableBase),
    };
  }

  const matched = resolveRule(ALL_RULES, tx, line, place, taxCode);

  if (!matched) {
    return {
      description: line.description,
      category: line.category,
      net,
      taxableBase,
      taxCode,
      ratePercent: 0,
      taxAmount: 0,
      treatment: "taxable",
      placeOfSupply: place,
      appliedRules: [],
      warnings: [
        `No rule matched for ${taxCode} in ${place.jurisdiction}. Defaulting to 0% — REVIEW REQUIRED. ${line.hints?.rationale ?? ""}`,
      ],
      total: round2(taxableBase),
    };
  }

  const { rule, applied } = matched;
  const ratePercent = rule.result.ratePercent ?? 0;
  const treatment: Treatment = rule.result.treatment ?? "taxable";

  // Tax amount.
  const taxAmount =
    treatment === "taxable" ? round2((taxableBase * ratePercent) / 100) : 0;

  // Equivalence surcharge if buyer is flagged + seller is in general regime
  // (wholesaler) + the matched rule is a positive-rate IVA rule.
  let surchargePercent: number | undefined;
  let surchargeAmount = 0;
  const buyerEquivalent = !!tx.buyer.subjectToEquivalenceSurcharge;
  const sellerIsWholesaler = tx.seller.regime === "general";
  if (
    taxCode === "IVA" &&
    treatment === "taxable" &&
    buyerEquivalent &&
    sellerIsWholesaler
  ) {
    surchargePercent = equivalenceSurchargeFor(ratePercent, !!line.hints?.isTobacco);
    if (surchargePercent != null) {
      surchargeAmount = round2((taxableBase * surchargePercent) / 100);
    }
  }

  // Per-line warnings.
  if (
    taxCode === "IVA" &&
    treatment === "exempt_with_credit" &&
    rule.id === "iva.zero.intra_eu_goods_b2b" &&
    !tx.buyer.viesValidatedAt
  ) {
    warnings.push(
      "Intra-community zero-rate requires a VIES-validated buyer VAT ID. Validate via VIES before issuing the invoice — otherwise apply standard IVA.",
    );
  }
  if (line.hints && (line.hints.confidence ?? 1) < 0.6) {
    warnings.push(
      `AI classification confidence is low (${Math.round((line.hints.confidence ?? 0) * 100)}%). Review category before relying on this rate. AI rationale: ${line.hints.rationale ?? "—"}`,
    );
  }

  // Total = taxable base + IVA + surcharge + IEDMT.
  // (Excise is already inside taxable base; don't double-count.)
  const total = round2(
    taxableBase + taxAmount + surchargeAmount + (iedmtResult?.amount ?? 0),
  );

  const appliedRules: AppliedRule[] = [applied];
  if (exciseResult) {
    appliedRules.push({
      ruleId: `iiee.${exciseResult.category}`,
      effectiveFrom: "1992-12-29",
      source: exciseResult.source,
      reasoning: `IIEE — ${exciseResult.rateDescription}.`,
    });
  }
  if (iedmtResult) {
    appliedRules.push({
      ruleId: "iedmt.bands",
      effectiveFrom: "2008-01-01",
      source: iedmtResult.source,
      reasoning: `IEDMT band ${iedmtResult.band} → ${iedmtResult.ratePercent}% on €${(line.quantity * line.unitPriceNet).toFixed(2)}.`,
    });
  }

  return {
    description: line.description,
    category: line.category,
    net,
    taxableBase,
    taxCode,
    ratePercent,
    taxAmount,
    equivalenceSurchargePercent: surchargePercent,
    equivalenceSurchargeAmount: surchargeAmount || undefined,
    excise: exciseResult ? { category: exciseResult.category, amount: exciseResult.amount } : undefined,
    iedmt: iedmtResult ? { ratePercent: iedmtResult.ratePercent, amount: iedmtResult.amount } : undefined,
    treatment,
    placeOfSupply: place,
    appliedRules,
    warnings,
    total,
  };
}

function applyDiscount(net: number, line: Line): number {
  if (!line.discount) return net;
  // Commercial / on-invoice discounts reduce the taxable base.
  // Financial discounts (post-payment) and post-invoice rectifications are out of MVP scope.
  if (line.discount.type === "commercial") {
    return round2(Math.max(0, net - line.discount.amount));
  }
  return net;
}

function aggregateTotals(lines: LineResult[]): CalculationTotals {
  const totals = lines.reduce(
    (acc, lr) => {
      acc.net += lr.net;
      acc.tax += lr.taxAmount;
      acc.surcharge += lr.equivalenceSurchargeAmount ?? 0;
      acc.excise += lr.excise?.amount ?? 0;
      acc.iedmt += lr.iedmt?.amount ?? 0;
      acc.total += lr.total;
      return acc;
    },
    { net: 0, tax: 0, surcharge: 0, excise: 0, iedmt: 0, total: 0 },
  );
  return {
    net: round2(totals.net),
    tax: round2(totals.tax),
    surcharge: round2(totals.surcharge),
    excise: round2(totals.excise),
    iedmt: round2(totals.iedmt),
    total: round2(totals.total),
  };
}

function transactionLevelWarnings(tx: Transaction): string[] {
  const out: string[] = [];
  if (tx.invoiceType === "simplified") {
    const total = tx.lines.reduce(
      (s, l) => s + l.quantity * l.unitPriceNet,
      0,
    );
    if (total > 400) {
      out.push(
        "Simplified invoices are restricted to total ≤ €400 (Art. 4 RD 1619/2012). Issue a full invoice instead.",
      );
    }
  }
  if (tx.seller.regime === "general" && !tx.seller.nif) {
    out.push("Seller NIF is required for invoicing (RD 1619/2012).");
  }
  if (tx.buyer.type === "business" && tx.buyer.country !== "ES" && EU_COUNTRIES[tx.buyer.country] && !tx.buyer.vatId) {
    out.push("Intra-community business buyer is missing a VAT ID — cannot apply zero-rate.");
  }
  return out;
}

/* --------------------------------------------------------------------- */
/* Helpers                                                                */
/* --------------------------------------------------------------------- */

/** Spanish round-half-up to 2 decimals (cent-level). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function dedupe<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

/** Stable, JSON-derived hash so the audit log can replay deterministically. */
export function fingerprintTransaction(tx: Transaction): string {
  // Insertion-order-stable JSON, then hash. We use a simple FNV-1a 32-bit hash
  // (no crypto deps; collisions are tolerable for cache keys, not security).
  const json = stableStringify({
    rulesVersion: RULES_VERSION,
    promptVersion: PROMPT_VERSION,
    tx,
  });
  return fnv1a(json).toString(16);
}

function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  const stringify = (v: unknown): unknown => {
    if (v === null || typeof v !== "object") return v;
    if (seen.has(v as object)) return "[circular]";
    seen.add(v as object);
    if (Array.isArray(v)) return v.map(stringify);
    const sortedKeys = Object.keys(v as Record<string, unknown>).sort();
    const out: Record<string, unknown> = {};
    for (const k of sortedKeys) out[k] = stringify((v as Record<string, unknown>)[k]);
    return out;
  };
  return JSON.stringify(stringify(value));
}

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}
