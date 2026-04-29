import type {
  AppliedRule,
  ClassificationHints,
  Line,
  PlaceOfSupply,
  Rule,
  RulePredicate,
  TaxCode,
  Transaction,
} from "./types";

/**
 * Find the single rule that applies to a (transaction, line, place-of-supply, taxCode)
 * combination, evaluating against the dated rule set.
 *
 * Process:
 *   1. Filter by date (effectiveFrom <= operationDate < effectiveTo ?? ∞).
 *   2. Filter by taxCode + jurisdiction match.
 *   3. Evaluate `applies` predicate against the transaction line.
 *   4. Sort matches by priority (descending).
 *   5. Return the highest-priority match. If multiple share the top priority,
 *      this is a rule-set bug — we surface it as a hard error so curators fix it.
 */
export function resolveRule(
  rules: Rule[],
  tx: Transaction,
  line: Line,
  place: PlaceOfSupply,
  taxCode: TaxCode,
): { rule: Rule; applied: AppliedRule } | undefined {
  const candidates = rules.filter((r) => {
    if (r.taxCode !== taxCode) return false;
    if (!isInForce(r, tx.operationDate)) return false;
    if (!matches(r.applies, tx, line, place)) return false;
    return true;
  });

  if (candidates.length === 0) return undefined;

  candidates.sort((a, b) => (b.priority ?? 100) - (a.priority ?? 100));
  const top = candidates[0];
  const tied = candidates.filter((c) => (c.priority ?? 100) === (top.priority ?? 100));
  if (tied.length > 1) {
    throw new Error(
      `Ambiguous rule match for line "${line.description}" — multiple rules tied at priority ${top.priority}: ${tied.map((r) => r.id).join(", ")}. Adjust priorities or predicates to disambiguate.`,
    );
  }

  return {
    rule: top,
    applied: {
      ruleId: top.id,
      effectiveFrom: top.effectiveFrom,
      effectiveTo: top.effectiveTo,
      source: top.source,
      reasoning: top.notes ?? `Matched predicate: ${describePredicate(top.applies)}`,
    },
  };
}

function isInForce(rule: Rule, isoDate: string): boolean {
  if (rule.effectiveFrom > isoDate) return false;
  if (rule.effectiveTo && rule.effectiveTo <= isoDate) return false;
  return true;
}

function matches(
  pred: RulePredicate,
  tx: Transaction,
  line: Line,
  place: PlaceOfSupply,
): boolean {
  if (pred.operationType && !pred.operationType.includes(tx.operationType)) return false;
  if (pred.taxCode) {
    // taxCode is filtered before predicate evaluation, but allow over-restriction here too.
  }
  if (pred.placeOfSupplyIn && !pred.placeOfSupplyIn.includes(place.jurisdiction)) return false;

  if (pred.buyerType && (!tx.buyer.type || !pred.buyerType.includes(tx.buyer.type))) return false;
  if (pred.buyerCountryIn && !pred.buyerCountryIn.includes(tx.buyer.country)) return false;
  if (pred.buyerCountryNotIn && pred.buyerCountryNotIn.includes(tx.buyer.country)) return false;
  if (pred.buyerRegionIn && (!tx.buyer.region || !pred.buyerRegionIn.includes(tx.buyer.region))) return false;
  if (pred.sellerRegionIn && (!tx.seller.region || !pred.sellerRegionIn.includes(tx.seller.region))) return false;
  if (pred.sellerRegimeIn && !pred.sellerRegimeIn.includes(tx.seller.regime)) return false;

  if (pred.categoryIn && (!line.category || !pred.categoryIn.includes(line.category))) return false;
  if (pred.categoryPrefix) {
    if (!line.category) return false;
    if (!pred.categoryPrefix.some((p) => line.category!.startsWith(p))) return false;
  }

  const hints = (line.hints ?? {}) as ClassificationHints;
  if (pred.requireHints) {
    for (const k of pred.requireHints) {
      if (!hints[k]) return false;
    }
  }
  if (pred.forbidHints) {
    for (const k of pred.forbidHints) {
      if (hints[k]) return false;
    }
  }

  return true;
}

function describePredicate(pred: RulePredicate): string {
  const parts: string[] = [];
  if (pred.operationType) parts.push(`operation in [${pred.operationType.join(", ")}]`);
  if (pred.placeOfSupplyIn) parts.push(`place in [${pred.placeOfSupplyIn.join(", ")}]`);
  if (pred.requireHints) parts.push(`hints: ${pred.requireHints.join(" & ")}`);
  if (pred.forbidHints) parts.push(`not: ${pred.forbidHints.join(" & ")}`);
  if (pred.buyerType) parts.push(`buyer in [${pred.buyerType.join(", ")}]`);
  if (pred.categoryIn) parts.push(`category in [${pred.categoryIn.slice(0, 3).join(", ")}…]`);
  return parts.join("; ");
}
