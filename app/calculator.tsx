"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { calculate } from "@/lib/engine";
import type {
  CalculationResult,
  Line,
  OperationType,
  PartyType,
  Region,
  Regime,
  Transaction,
} from "@/lib/engine/types";
import { classifyLine, type ClassifierContext } from "@/lib/ai/classifier";

/* --------------------------------------------------------------------- */
/* Reference data for selects                                             */
/* --------------------------------------------------------------------- */

const REGIONS: { value: Region; label: string }[] = [
  { value: "mainland", label: "Mainland" },
  { value: "balearic", label: "Balearic Islands" },
  { value: "canary", label: "Canary Islands" },
  { value: "ceuta", label: "Ceuta" },
  { value: "melilla", label: "Melilla" },
  { value: "pais_vasco", label: "Basque Country" },
  { value: "navarra", label: "Navarre" },
];

const REGIMES: { value: Regime; label: string }[] = [
  { value: "general", label: "General regime" },
  { value: "equivalence_surcharge", label: "Equivalence surcharge" },
  { value: "reagp", label: "Agriculture (REAGP)" },
  { value: "rebu", label: "Used goods (REBU)" },
  { value: "travel_agency", label: "Travel agencies" },
  { value: "simplified", label: "Simplified (módulos)" },
  { value: "group", label: "Group of entities" },
  { value: "cash_basis", label: "Cash-basis" },
  { value: "investment_gold", label: "Investment gold" },
];

const OPERATION_TYPES: { value: OperationType; label: string }[] = [
  { value: "goods_supply", label: "Goods supply" },
  { value: "services_supply", label: "Services supply" },
  { value: "intra_eu_acquisition", label: "Intra-EU acquisition" },
  { value: "import", label: "Import" },
  { value: "export", label: "Export" },
  { value: "self_supply", label: "Self-supply" },
  { value: "free_supply", label: "Free supply" },
  { value: "advance_payment", label: "Advance payment" },
];

const COMMON_COUNTRIES = [
  "ES", "FR", "PT", "DE", "IT", "NL", "BE", "IE", "PL", "RO", "SE", "DK", "AT", "FI",
  "GB", "US", "CH", "MX", "MA", "BR",
];

/* --------------------------------------------------------------------- */
/* Defaults                                                               */
/* --------------------------------------------------------------------- */

function emptyLine(): Line & { _classifying?: boolean; _classifyError?: string } {
  return {
    description: "",
    quantity: 1,
    unitPriceNet: 0,
    hints: {},
  };
}

function defaultTransaction(): Transaction {
  const today = new Date().toISOString().slice(0, 10);
  return {
    operationDate: today,
    operationType: "goods_supply",
    currency: "EUR",
    seller: {
      country: "ES",
      region: "mainland",
      regime: "general",
      type: "business",
    },
    buyer: {
      country: "ES",
      region: "mainland",
      type: "business",
    },
    lines: [emptyLine()],
  };
}

const STORAGE_TX = "spain-tax:tx";
const STORAGE_KEY = "spain-tax:openai-key";

/* --------------------------------------------------------------------- */
/* Component                                                              */
/* --------------------------------------------------------------------- */

export default function Calculator() {
  const [tx, setTx] = useState<Transaction>(() => defaultTransaction());
  const [apiKey, setApiKey] = useState<string>("");
  const [keyVisible, setKeyVisible] = useState(false);
  const [classifyState, setClassifyState] = useState<Record<number, "idle" | "loading" | "done" | "error">>({});
  const [classifyError, setClassifyError] = useState<Record<number, string | undefined>>({});
  const debounceRef = useRef<Record<number, number>>({});

  // Hydrate from localStorage.
  useEffect(() => {
    try {
      const k = localStorage.getItem(STORAGE_KEY);
      if (k) setApiKey(k);
      const t = localStorage.getItem(STORAGE_TX);
      if (t) setTx(JSON.parse(t) as Transaction);
    } catch {
      /* ignore */
    }
  }, []);
  // Persist transaction (not the lines being edited too aggressively — just the snapshot).
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_TX, JSON.stringify(tx));
    } catch {
      /* ignore */
    }
  }, [tx]);
  useEffect(() => {
    try {
      if (apiKey) localStorage.setItem(STORAGE_KEY, apiKey);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, [apiKey]);

  const result: CalculationResult = useMemo(() => calculate(tx), [tx]);

  const loadingIndices = Object.entries(classifyState)
    .filter(([, v]) => v === "loading")
    .map(([k]) => Number(k));

  /* ----------------- mutators ----------------- */

  const updateTx = (patch: Partial<Transaction>) => setTx((t) => ({ ...t, ...patch }));
  const updateSeller = (patch: Partial<Transaction["seller"]>) =>
    setTx((t) => ({ ...t, seller: { ...t.seller, ...patch } }));
  const updateBuyer = (patch: Partial<Transaction["buyer"]>) =>
    setTx((t) => ({ ...t, buyer: { ...t.buyer, ...patch } }));
  const updateLine = (i: number, patch: Partial<Line>) =>
    setTx((t) => {
      const lines = t.lines.slice();
      lines[i] = { ...lines[i], ...patch };
      return { ...t, lines };
    });
  const addLine = () => setTx((t) => ({ ...t, lines: [...t.lines, emptyLine()] }));
  const removeLine = (i: number) =>
    setTx((t) => ({ ...t, lines: t.lines.length > 1 ? t.lines.filter((_, idx) => idx !== i) : t.lines }));

  /* ----------------- AI classify ----------------- */

  const classify = async (i: number) => {
    if (!apiKey) {
      setClassifyState((s) => ({ ...s, [i]: "error" }));
      setClassifyError((e) => ({ ...e, [i]: "Set your OpenAI key first." }));
      return;
    }
    const line = tx.lines[i];
    if (!line.description.trim()) return;

    setClassifyState((s) => ({ ...s, [i]: "loading" }));
    setClassifyError((e) => ({ ...e, [i]: undefined }));

    const ctx: ClassifierContext = {
      operationType: tx.operationType,
      buyerCountry: tx.buyer.country,
      buyerRegion: tx.buyer.region,
      buyerType: tx.buyer.type,
      sellerRegion: tx.seller.region,
      unitPriceNet: line.unitPriceNet,
      quantity: line.quantity,
      invoiceTotal: tx.lines.reduce((s, l) => s + l.quantity * l.unitPriceNet, 0),
    };

    try {
      const { hints, cached } = await classifyLine({
        description: line.description,
        context: ctx,
        apiKey,
      });
      const { category, ...rest } = hints;
      const enriched = { ...rest, _cached: cached } as typeof rest & { _cached?: boolean };
      updateLine(i, { hints: enriched, category: category || line.category });
      setClassifyState((s) => ({ ...s, [i]: "done" }));
    } catch (err) {
      setClassifyState((s) => ({ ...s, [i]: "error" }));
      setClassifyError((e) => ({ ...e, [i]: (err as Error).message }));
    }
  };

  // Debounced auto-classify when description + amount stop changing.
  useEffect(() => {
    if (!apiKey) return;
    tx.lines.forEach((line, i) => {
      if (!line.description.trim()) return;
      // Skip if hints already non-empty AND the description hasn't changed enough to warrant re-classify.
      // Cache makes re-runs cheap, so we just always debounce.
      window.clearTimeout(debounceRef.current[i]);
      debounceRef.current[i] = window.setTimeout(() => {
        classify(i);
      }, 700);
    });
    return () => {
      Object.values(debounceRef.current).forEach((id) => window.clearTimeout(id));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx.lines.map((l) => `${l.description}|${l.unitPriceNet}|${l.quantity}`).join("¶"), apiKey, tx.operationType, tx.buyer.country, tx.buyer.region, tx.buyer.type]);

  /* ----------------- render ----------------- */

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar
        apiKey={apiKey}
        keyVisible={keyVisible}
        onApiKey={setApiKey}
        onToggleVisible={() => setKeyVisible((v) => !v)}
        rulesVersion={result.rulesVersion}
      />
      {loadingIndices.length > 0 && (
        <div className="classify-banner">
          <span className="thinking-dots" aria-hidden>
            <span /> <span /> <span />
          </span>
          <span>
            Classifying {loadingIndices.length === 1 ? "line" : "lines"}{" "}
            <span className="num">
              {loadingIndices.map((i) => i + 1).join(", ")}
            </span>{" "}
            with <span className="num">gpt-4o-mini</span>
          </span>
          <span className="ml-auto text-[11px] num" style={{ color: "var(--color-fg-tertiary)" }}>
            temperature 0 · seed 42
          </span>
        </div>
      )}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,460px)_1fr] gap-0">
        <FormPane
          tx={tx}
          updateTx={updateTx}
          updateSeller={updateSeller}
          updateBuyer={updateBuyer}
          updateLine={updateLine}
          addLine={addLine}
          removeLine={removeLine}
          classifyState={classifyState}
          classifyError={classifyError}
          onClassify={classify}
          hasApiKey={!!apiKey}
        />
        <ResultPane result={result} tx={tx} classifyState={classifyState} />
      </main>
      <footer className="px-6 py-4 border-t border-[color:var(--color-separator-soft)] text-[11px] text-[color:var(--color-fg-tertiary)]">
        Informational only. Not tax advice. Verify with your tax advisor before issuing invoices. Rules version{" "}
        <span className="num">{result.rulesVersion}</span>.
      </footer>
    </div>
  );
}

/* --------------------------------------------------------------------- */
/* Top bar                                                                */
/* --------------------------------------------------------------------- */

function TopBar({
  apiKey,
  keyVisible,
  onApiKey,
  onToggleVisible,
  rulesVersion,
}: {
  apiKey: string;
  keyVisible: boolean;
  onApiKey: (k: string) => void;
  onToggleVisible: () => void;
  rulesVersion: string;
}) {
  return (
    <header
      className="sticky top-0 z-10 backdrop-blur"
      style={{
        background: "color-mix(in oklab, var(--color-bg) 80%, transparent)",
        borderBottom: "1px solid var(--color-separator-soft)",
      }}
    >
      <div className="px-6 py-3 flex items-center gap-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[15px] font-semibold tracking-tight">Spain Tax</h1>
          <span className="text-[11px] text-[color:var(--color-fg-tertiary)] tracking-wide">
            IVA · IGIC · IPSI
          </span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-[color:var(--color-fg-tertiary)] tracking-wide">
            OpenAI key
          </label>
          <input
            className="field-input"
            style={{ width: 240, height: 28, padding: "4px 8px", fontSize: 12 }}
            type={keyVisible ? "text" : "password"}
            placeholder="sk-…"
            value={apiKey}
            onChange={(e) => onApiKey(e.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
          <button className="btn btn-ghost" onClick={onToggleVisible} type="button">
            {keyVisible ? "Hide" : "Show"}
          </button>
          <span
            className="text-[11px] num"
            style={{ color: "var(--color-fg-tertiary)" }}
            title="Rules version in effect"
          >
            {rulesVersion}
          </span>
        </div>
      </div>
    </header>
  );
}

/* --------------------------------------------------------------------- */
/* Form pane                                                              */
/* --------------------------------------------------------------------- */

function FormPane(props: {
  tx: Transaction;
  updateTx: (p: Partial<Transaction>) => void;
  updateSeller: (p: Partial<Transaction["seller"]>) => void;
  updateBuyer: (p: Partial<Transaction["buyer"]>) => void;
  updateLine: (i: number, p: Partial<Line>) => void;
  addLine: () => void;
  removeLine: (i: number) => void;
  classifyState: Record<number, "idle" | "loading" | "done" | "error">;
  classifyError: Record<number, string | undefined>;
  onClassify: (i: number) => void;
  hasApiKey: boolean;
}) {
  const { tx, updateTx, updateSeller, updateBuyer, updateLine, addLine, removeLine, classifyState, classifyError, onClassify, hasApiKey } = props;

  return (
    <section
      className="border-r overflow-y-auto"
      style={{ borderColor: "var(--color-separator-soft)", maxHeight: "calc(100vh - 49px - 49px)" }}
    >
      <div className="p-6 space-y-7">
        {/* Operation */}
        <Section title="Operation">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input
                className="field-input"
                type="date"
                value={tx.operationDate}
                onChange={(e) => updateTx({ operationDate: e.target.value })}
              />
            </Field>
            <Field label="Type">
              <select
                className="field-select"
                value={tx.operationType}
                onChange={(e) => updateTx({ operationType: e.target.value as OperationType })}
              >
                {OPERATION_TYPES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Section>

        {/* Seller */}
        <Section title="Seller">
          <div className="grid grid-cols-2 gap-3">
            <Field label="NIF">
              <input
                className="field-input"
                placeholder="B12345678"
                value={tx.seller.nif ?? ""}
                onChange={(e) => updateSeller({ nif: e.target.value })}
              />
            </Field>
            <Field label="Region">
              <select
                className="field-select"
                value={tx.seller.region}
                onChange={(e) => updateSeller({ region: e.target.value as Region })}
              >
                {REGIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Regime">
              <select
                className="field-select"
                value={tx.seller.regime}
                onChange={(e) => updateSeller({ regime: e.target.value as Regime })}
              >
                {REGIMES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="OSS registered">
              <select
                className="field-select"
                value={tx.seller.ossRegistered ? "yes" : "no"}
                onChange={(e) => updateSeller({ ossRegistered: e.target.value === "yes" })}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </Field>
          </div>
        </Section>

        {/* Buyer */}
        <Section title="Buyer">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select
                className="field-select"
                value={tx.buyer.type ?? "consumer"}
                onChange={(e) => updateBuyer({ type: e.target.value as PartyType })}
              >
                <option value="business">Business (B2B)</option>
                <option value="consumer">Consumer (B2C)</option>
                <option value="public_admin">Public administration</option>
                <option value="exempt_entity">Exempt entity</option>
              </select>
            </Field>
            <Field label="Country">
              <select
                className="field-select"
                value={tx.buyer.country}
                onChange={(e) => updateBuyer({ country: e.target.value })}
              >
                {COMMON_COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            {tx.buyer.country === "ES" && (
              <Field label="Region">
                <select
                  className="field-select"
                  value={tx.buyer.region ?? "mainland"}
                  onChange={(e) => updateBuyer({ region: e.target.value as Region })}
                >
                  {REGIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label={tx.buyer.country === "ES" ? "NIF" : "VAT ID"}>
              <input
                className="field-input"
                placeholder={tx.buyer.country === "ES" ? "B12345678" : "FR12345678901"}
                value={tx.buyer.country === "ES" ? tx.buyer.nif ?? "" : tx.buyer.vatId ?? ""}
                onChange={(e) =>
                  tx.buyer.country === "ES"
                    ? updateBuyer({ nif: e.target.value })
                    : updateBuyer({ vatId: e.target.value })
                }
              />
            </Field>
            {tx.buyer.country !== "ES" && (
              <Field label="VIES validated">
                <select
                  className="field-select"
                  value={tx.buyer.viesValidatedAt ? "yes" : "no"}
                  onChange={(e) =>
                    updateBuyer({
                      viesValidatedAt: e.target.value === "yes" ? new Date().toISOString() : undefined,
                    })
                  }
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </Field>
            )}
            {tx.buyer.country === "ES" && (
              <Field label="Equivalence surcharge">
                <select
                  className="field-select"
                  value={tx.buyer.subjectToEquivalenceSurcharge ? "yes" : "no"}
                  onChange={(e) =>
                    updateBuyer({ subjectToEquivalenceSurcharge: e.target.value === "yes" })
                  }
                >
                  <option value="no">No</option>
                  <option value="yes">Yes (retailer)</option>
                </select>
              </Field>
            )}
          </div>
        </Section>

        {/* Lines */}
        <Section
          title="Lines"
          right={
            <button className="btn btn-ghost" onClick={addLine} type="button">
              + Add line
            </button>
          }
        >
          <div className="space-y-4">
            {tx.lines.map((line, i) => (
              <div key={i} className="space-y-2">
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-12">
                    <input
                      className="field-input"
                      placeholder='e.g. "wholemeal bread loaf 500g" or "marketing consulting service"'
                      value={line.description}
                      onChange={(e) => updateLine(i, { description: e.target.value })}
                    />
                  </div>
                  <div className="col-span-3">
                    <input
                      className="field-input num text-right"
                      type="number"
                      step="0.01"
                      min={0}
                      value={line.quantity}
                      onChange={(e) => updateLine(i, { quantity: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="col-span-5">
                    <input
                      className="field-input num text-right"
                      type="number"
                      step="0.01"
                      min={0}
                      value={line.unitPriceNet}
                      onChange={(e) => updateLine(i, { unitPriceNet: parseFloat(e.target.value) || 0 })}
                      placeholder="Unit price (net)"
                    />
                  </div>
                  <div className="col-span-3 flex items-center justify-end gap-2 text-[12px]">
                    <span className="num text-[color:var(--color-fg-secondary)]">
                      €{(line.quantity * line.unitPriceNet).toFixed(2)}
                    </span>
                    <button
                      className="btn btn-ghost btn-danger"
                      onClick={() => removeLine(i)}
                      type="button"
                      title="Remove line"
                      style={{ padding: "0 6px" }}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="col-span-12">
                    <ClassificationStrip
                      line={line}
                      state={classifyState[i] ?? "idle"}
                      error={classifyError[i]}
                      onRetry={() => onClassify(i)}
                      hasApiKey={hasApiKey}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </section>
  );
}

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="section-title">{title}</h2>
        {right}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}

function ClassificationStrip({
  line,
  state,
  error,
  onRetry,
  hasApiKey,
}: {
  line: Line;
  state: "idle" | "loading" | "done" | "error";
  error?: string;
  onRetry: () => void;
  hasApiKey: boolean;
}) {
  const flags = useMemo(() => {
    const out: string[] = [];
    const h = line.hints ?? {};
    const map: [keyof typeof h, string][] = [
      ["isBasicFood", "Basic food"],
      ["isAlcoholic", "Alcoholic"],
      ["isTobacco", "Tobacco"],
      ["isMedicineForHumanUse", "Medicine"],
      ["isVeterinaryMedicine", "Veterinary"],
      ["isBookOrPeriodical", "Book / periodical"],
      ["isWaterSupply", "Water"],
      ["isFlowerOrPlant", "Flowers / plants"],
      ["isAgriculturalInput", "Agri input"],
      ["isAgricultureProduct", "Agriculture"],
      ["isSanitaryProduct", "Sanitary"],
      ["isFeminineHygieneProduct", "Feminine hygiene"],
      ["isVehicleForDisability", "Disability vehicle"],
      ["isPreciousMetal", "Precious metal"],
      ["isInvestmentGold", "Investment gold"],
      ["isEmissionRight", "Emission rights"],
      ["isEnergyCertificate", "Energy cert"],
      ["isElectronicDeviceOver10k", "Electronics >€10k"],
      ["isScrap", "Scrap"],
      ["isUsedGoods", "Used goods"],
      ["isHospitality", "Hospitality"],
      ["isPassengerTransport", "Passenger transport"],
      ["isCulturalEvent", "Cultural"],
      ["isCulturalServicePublic", "Cultural (public)"],
      ["isSportsServiceNonProfit", "Sports (non-profit)"],
      ["isHealthcareService", "Healthcare"],
      ["isEducationService", "Education"],
      ["isFinancialService", "Financial"],
      ["isInsurance", "Insurance"],
      ["isPostalService", "Postal"],
      ["isLotteryOrBetting", "Lottery"],
      ["isSocialServiceNonProfit", "Social"],
      ["isNonProfitMembership", "Non-profit dues"],
      ["isDigitalService", "Digital"],
      ["isTelecomBroadcast", "Telecom"],
      ["isConstructionServiceB2B", "Construction B2B"],
      ["isHairdressing", "Hairdressing"],
      ["isDisabledAssistanceService", "Disability assistance"],
      ["isRealEstateRelated", "Real-estate"],
      ["isRentalDwelling", "Rental dwelling"],
      ["isRentalCommercial", "Rental commercial"],
      ["isFirstTransmissionDwelling", "1st transmission"],
      ["isSecondTransmissionBuilding", "2nd transmission"],
      ["isLandSale", "Land sale"],
      ["isSocialHousingVPO", "VPO"],
      ["isVATWaiverApplied", "Art. 20.Dos waiver"],
    ];
    for (const [k, label] of map) if (h[k]) out.push(label);
    return out;
  }, [line.hints]);

  return (
    <div className="space-y-2">
      {state === "loading" && <div className="progress-strip" aria-hidden />}
      <div className="flex items-center gap-2 flex-wrap">
        {state === "loading" ? (
          <span className="inline-flex items-center gap-2 text-[12px] text-[color:var(--color-fg-secondary)]">
            <span className="thinking-dots" aria-hidden>
              <span /> <span /> <span />
            </span>
            <span>Classifying with AI</span>
          </span>
        ) : line.category ? (
          <span className="glass-chip glass-chip-mono" title="Category from AI">
            {line.category}
          </span>
        ) : (
          <span className="text-[12px] text-[color:var(--color-fg-tertiary)]">
            {hasApiKey ? "Awaiting classification" : "Set your OpenAI key to auto-classify, or pick a category manually"}
          </span>
        )}
        {state !== "loading" &&
          flags.map((f) => (
            <span key={f} className="glass-chip">
              {f}
            </span>
          ))}
        {state === "error" && (
          <button className="btn btn-ghost btn-danger" type="button" onClick={onRetry} title={error}>
            Retry
          </button>
        )}
        {state !== "loading" && line.hints?.confidence != null && (
          <span
            className="num text-[11px] text-[color:var(--color-fg-tertiary)] ml-auto"
            title={line.hints.rationale}
          >
            {Math.round((line.hints.confidence ?? 0) * 100)}%
          </span>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- */
/* AI insight panel — featured inside each "Why this rate?" disclosure    */
/* --------------------------------------------------------------------- */

function ConfidenceDial({ value, color }: { value: number; color: string }) {
  const pct = Math.max(0, Math.min(1, value));
  const trackBg = "var(--color-separator-soft)";
  return (
    <div className="flex flex-col items-end gap-1.5" style={{ width: 100 }}>
      <span className="text-[11px] uppercase tracking-wide" style={{ color: "var(--color-fg-tertiary)" }}>
        Confidence
      </span>
      <div
        className="num text-[15px] font-semibold tabular-nums"
        style={{ color, lineHeight: 1 }}
      >
        {Math.round(pct * 100)}
        <span className="text-[10px] font-normal" style={{ color: "var(--color-fg-tertiary)" }}>
          {" "}
          %
        </span>
      </div>
      <div
        aria-hidden
        style={{
          width: "100%",
          height: 3,
          background: trackBg,
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct * 100}%`,
            height: "100%",
            background: color,
            transition: "width 240ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          }}
        />
      </div>
    </div>
  );
}

function AIInsight({
  hints,
  category,
  state,
}: {
  hints?: Line["hints"] & { _cached?: boolean };
  category?: string;
  state: "idle" | "loading" | "done" | "error";
}) {
  const flagMap: { key: keyof NonNullable<Line["hints"]>; label: string }[] = [
    { key: "isBasicFood", label: "Basic food" },
    { key: "isAlcoholic", label: "Alcoholic" },
    { key: "isTobacco", label: "Tobacco" },
    { key: "isMedicineForHumanUse", label: "Medicine (human)" },
    { key: "isVeterinaryMedicine", label: "Veterinary medicine" },
    { key: "isBookOrPeriodical", label: "Book / periodical" },
    { key: "isWaterSupply", label: "Water" },
    { key: "isFlowerOrPlant", label: "Flowers / plants" },
    { key: "isAgriculturalInput", label: "Agricultural input" },
    { key: "isAgricultureProduct", label: "Agriculture (REAGP)" },
    { key: "isSanitaryProduct", label: "Sanitary product" },
    { key: "isFeminineHygieneProduct", label: "Feminine hygiene" },
    { key: "isVehicleForDisability", label: "Disability vehicle" },
    { key: "isPreciousMetal", label: "Precious metal" },
    { key: "isInvestmentGold", label: "Investment gold" },
    { key: "isEmissionRight", label: "Emission rights" },
    { key: "isEnergyCertificate", label: "Energy certificate" },
    { key: "isElectronicDeviceOver10k", label: "Electronics >€10k" },
    { key: "isScrap", label: "Scrap" },
    { key: "isUsedGoods", label: "Used goods" },
    { key: "isHospitality", label: "Hospitality" },
    { key: "isPassengerTransport", label: "Passenger transport" },
    { key: "isCulturalEvent", label: "Cultural event" },
    { key: "isCulturalServicePublic", label: "Cultural (public/non-profit)" },
    { key: "isSportsServiceNonProfit", label: "Sports (non-profit)" },
    { key: "isHealthcareService", label: "Healthcare" },
    { key: "isEducationService", label: "Education" },
    { key: "isFinancialService", label: "Financial" },
    { key: "isInsurance", label: "Insurance" },
    { key: "isPostalService", label: "Postal" },
    { key: "isLotteryOrBetting", label: "Lottery / betting" },
    { key: "isSocialServiceNonProfit", label: "Social services" },
    { key: "isNonProfitMembership", label: "Non-profit dues" },
    { key: "isDigitalService", label: "Digital service" },
    { key: "isTelecomBroadcast", label: "Telecom / broadcast" },
    { key: "isConstructionServiceB2B", label: "Construction B2B" },
    { key: "isHairdressing", label: "Hairdressing" },
    { key: "isDisabledAssistanceService", label: "Disability assistance" },
    { key: "isRealEstateRelated", label: "Real-estate" },
    { key: "isRentalDwelling", label: "Rental (dwelling)" },
    { key: "isRentalCommercial", label: "Rental (commercial)" },
    { key: "isFirstTransmissionDwelling", label: "1st transmission dwelling" },
    { key: "isSecondTransmissionBuilding", label: "2nd transmission building" },
    { key: "isLandSale", label: "Land sale" },
    { key: "isSocialHousingVPO", label: "Social housing (VPO)" },
    { key: "isVATWaiverApplied", label: "Art. 20.Dos waiver" },
  ];

  const hasHints = hints && Object.keys(hints).some((k) => k !== "_cached" && (hints as Record<string, unknown>)[k]);
  const flags = hasHints
    ? flagMap.filter(({ key }) => Boolean((hints as Record<string, unknown>)[key]))
    : [];

  const conf = hints?.confidence ?? null;
  const cached = (hints as { _cached?: boolean } | undefined)?._cached;
  const rationale = hints?.rationale;

  const confColor =
    conf == null
      ? "var(--color-fg-tertiary)"
      : conf >= 0.85
        ? "var(--color-success)"
        : conf >= 0.6
          ? "var(--color-fg-secondary)"
          : "var(--color-warning)";

  const isLoading = state === "loading";

  return (
    <div className="glass-card p-4 relative overflow-hidden">
      {/* Top progress bar — only when classifying */}
      {isLoading && (
        <div
          aria-hidden
          className="progress-strip absolute left-0 right-0 top-0 rounded-none"
          style={{ height: 2 }}
        />
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`ai-badge ${isLoading ? "ai-badge--live" : ""}`}>AI</span>
          <span className="section-title" style={{ color: "var(--color-fg-secondary)" }}>
            Classification
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--color-fg-tertiary)" }}>
          <span className="num">gpt-4o-mini</span>
          {cached && !isLoading && (
            <span
              className="glass-chip glass-chip-mono"
              title="Loaded from local cache — no API call made"
              style={{ height: 18, padding: "0 6px", fontSize: 10 }}
            >
              cached
            </span>
          )}
          {isLoading && (
            <span className="inline-flex items-center gap-1.5" style={{ color: "var(--color-fg-secondary)" }}>
              <span className="thinking-dots" aria-hidden>
                <span /> <span /> <span />
              </span>
              classifying
            </span>
          )}
        </div>
      </div>

      {/* LOADING — skeleton */}
      {isLoading && (
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-x-6 gap-y-3 items-start">
          <div className="space-y-2 min-w-0 w-full">
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wide" style={{ color: "var(--color-fg-tertiary)" }}>
                Category
              </span>
              <div className="skeleton" style={{ width: 160, height: 18 }} />
            </div>
            <div className="skeleton" style={{ width: "85%", height: 14, marginTop: 6 }} />
            <div className="skeleton" style={{ width: "65%", height: 14 }} />
            <div className="flex flex-wrap gap-1.5 pt-1">
              <div className="skeleton" style={{ width: 70, height: 22, borderRadius: 6 }} />
              <div className="skeleton" style={{ width: 90, height: 22, borderRadius: 6 }} />
              <div className="skeleton" style={{ width: 60, height: 22, borderRadius: 6 }} />
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5" style={{ width: 100 }}>
            <span className="text-[11px] uppercase tracking-wide" style={{ color: "var(--color-fg-tertiary)" }}>
              Confidence
            </span>
            <div className="skeleton" style={{ width: 50, height: 18 }} />
            <div className="skeleton" style={{ width: "100%", height: 3, borderRadius: 999 }} />
          </div>
        </div>
      )}

      {/* IDLE — no hints yet */}
      {!hasHints && !isLoading && (
        <p className="mt-3 text-[12px]" style={{ color: "var(--color-fg-tertiary)" }}>
          No AI classification yet. Set your OpenAI key, or pick a category manually.
        </p>
      )}

      {/* DONE — hints present */}
      {hasHints && !isLoading && (
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-x-6 gap-y-3 items-start">
          <div className="space-y-2.5 min-w-0">
            {category && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wide" style={{ color: "var(--color-fg-tertiary)" }}>
                  Category
                </span>
                <span className="glass-chip glass-chip-mono" style={{ fontSize: 12 }}>
                  {category}
                </span>
              </div>
            )}
            {rationale && (
              <p
                className="text-[13px] leading-relaxed"
                style={{
                  color: "var(--color-fg-secondary)",
                  fontStyle: "italic",
                  borderLeft: "2px solid var(--color-separator)",
                  paddingLeft: 10,
                }}
              >
                &ldquo;{rationale}&rdquo;
              </p>
            )}
            {flags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {flags.map((f) => (
                  <span key={f.key} className="glass-chip glass-chip-strong">
                    {f.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          <ConfidenceDial value={conf ?? 0} color={confColor} />
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------- */
/* Result pane                                                            */
/* --------------------------------------------------------------------- */

function ResultPane({
  result,
  tx,
  classifyState,
}: {
  result: CalculationResult;
  tx: Transaction;
  classifyState: Record<number, "idle" | "loading" | "done" | "error">;
}) {
  // AI summary across all lines
  const linesWithHints = tx.lines.filter((l) => l.hints && Object.keys(l.hints).length > 0);
  const avgConfidence = linesWithHints.length
    ? linesWithHints.reduce((s, l) => s + (l.hints?.confidence ?? 0), 0) / linesWithHints.length
    : 0;

  return (
    <section className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 49px - 49px)" }}>
      <div className="p-6 space-y-7">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="section-title">Calculation</div>
            <h2 className="text-[20px] font-semibold tracking-tight mt-1">Tax breakdown</h2>
          </div>
          <div className="text-right space-y-1">
            <div>
              <div className="text-[11px] text-[color:var(--color-fg-tertiary)] tracking-wide uppercase">
                Authority
              </div>
              <div className="text-[13px] font-medium">{result.taxAuthority}</div>
            </div>
            {linesWithHints.length > 0 && (
              <div className="text-[11px] text-[color:var(--color-fg-tertiary)] num">
                {linesWithHints.length}/{tx.lines.length} classified · avg conf{" "}
                {Math.round(avgConfidence * 100)}%
              </div>
            )}
          </div>
        </div>

        {/* Lines */}
        <div className="border rounded-lg overflow-hidden" style={{ borderColor: "var(--color-separator)" }}>
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: "var(--color-surface-2)" }}>
                <th className="text-left font-medium px-3 py-2 text-[11px] uppercase tracking-wide text-[color:var(--color-fg-tertiary)]">
                  Description
                </th>
                <th className="text-left font-medium px-3 py-2 text-[11px] uppercase tracking-wide text-[color:var(--color-fg-tertiary)]">
                  Treatment
                </th>
                <th className="text-right font-medium px-3 py-2 text-[11px] uppercase tracking-wide text-[color:var(--color-fg-tertiary)]">
                  Base
                </th>
                <th className="text-right font-medium px-3 py-2 text-[11px] uppercase tracking-wide text-[color:var(--color-fg-tertiary)]">
                  Rate
                </th>
                <th className="text-right font-medium px-3 py-2 text-[11px] uppercase tracking-wide text-[color:var(--color-fg-tertiary)]">
                  Tax
                </th>
                <th className="text-right font-medium px-3 py-2 text-[11px] uppercase tracking-wide text-[color:var(--color-fg-tertiary)]">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {result.lines.map((lr, i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--color-separator-soft)" }}>
                  <td className="px-3 py-2 align-top">
                    <div className="font-medium">{lr.description || <em className="text-[color:var(--color-fg-tertiary)]">Untitled line</em>}</div>
                    <div className="text-[11px] text-[color:var(--color-fg-tertiary)] mt-0.5">
                      {lr.placeOfSupply.jurisdiction} · {lr.taxCode}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <TreatmentBadge treatment={lr.treatment} />
                  </td>
                  <td className="px-3 py-2 align-top text-right num">€{lr.taxableBase.toFixed(2)}</td>
                  <td className="px-3 py-2 align-top text-right num">
                    {lr.treatment === "taxable" ? `${lr.ratePercent}%` : "—"}
                  </td>
                  <td className="px-3 py-2 align-top text-right num">€{lr.taxAmount.toFixed(2)}</td>
                  <td className="px-3 py-2 align-top text-right num">€{lr.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Per-line "why this rate" disclosures */}
        <div className="space-y-3">
          {result.lines.map((lr, i) => (
            <details
              key={i}
              className="border rounded-lg p-3"
              style={{ borderColor: "var(--color-separator-soft)" }}
            >
              <summary className="text-[13px] font-medium">
                Why this rate? — line {i + 1} ({lr.description || "untitled"})
              </summary>
              <div className="mt-3 space-y-4 text-[13px] leading-relaxed">
                <AIInsight
                  hints={tx.lines[i]?.hints}
                  category={tx.lines[i]?.category}
                  state={classifyState[i] ?? "idle"}
                />
                <div>
                  <div className="section-title">Place of supply</div>
                  <p className="mt-1 text-[color:var(--color-fg-secondary)]">{lr.placeOfSupply.reason}</p>
                </div>
                <div>
                  <div className="section-title">Applied rules</div>
                  <ul className="mt-1 space-y-2">
                    {lr.appliedRules.length === 0 && (
                      <li className="text-[color:var(--color-fg-tertiary)]">No rule matched.</li>
                    )}
                    {lr.appliedRules.map((ar) => (
                      <li key={ar.ruleId} className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="cite">{ar.ruleId}</span>
                          <span className="text-[11px] text-[color:var(--color-fg-tertiary)]">
                            since <span className="num">{ar.effectiveFrom}</span>
                            {ar.effectiveTo ? <> · until <span className="num">{ar.effectiveTo}</span></> : null}
                          </span>
                        </div>
                        <div className="text-[color:var(--color-fg-secondary)]">{ar.reasoning}</div>
                        <div className="flex flex-wrap gap-1">
                          {ar.source.map((s) => (
                            <span key={s} className="cite">
                              {s}
                            </span>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                {lr.warnings.length > 0 && (
                  <div>
                    <div className="section-title" style={{ color: "var(--color-warning)" }}>
                      Warnings
                    </div>
                    <ul className="mt-1 space-y-1">
                      {lr.warnings.map((w, j) => (
                        <li key={j} className="text-[color:var(--color-warning)]">
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>

        {/* Mandatory invoice mentions */}
        {result.invoiceMentions.length > 0 && (
          <div>
            <div className="section-title">Mandatory invoice mentions</div>
            <ul className="mt-2 space-y-1 text-[13px] text-[color:var(--color-fg-secondary)]">
              {result.invoiceMentions.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Top-level warnings */}
        {result.warnings.length > 0 && (
          <div>
            <div className="section-title" style={{ color: "var(--color-warning)" }}>
              Transaction warnings
            </div>
            <ul className="mt-2 space-y-1 text-[13px]" style={{ color: "var(--color-warning)" }}>
              {result.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Totals */}
        <div className="border-t pt-4" style={{ borderColor: "var(--color-separator)" }}>
          <div className="grid grid-cols-2 gap-y-1.5 max-w-sm ml-auto text-[13px]">
            <span className="text-[color:var(--color-fg-secondary)]">Net</span>
            <span className="text-right num">€{result.totals.net.toFixed(2)}</span>
            <span className="text-[color:var(--color-fg-secondary)]">Tax</span>
            <span className="text-right num">€{result.totals.tax.toFixed(2)}</span>
            {result.totals.surcharge > 0 && (
              <>
                <span className="text-[color:var(--color-fg-secondary)]">Surcharge</span>
                <span className="text-right num">€{result.totals.surcharge.toFixed(2)}</span>
              </>
            )}
            <span className="font-semibold">Total</span>
            <span className="text-right font-semibold num">€{result.totals.total.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function TreatmentBadge({ treatment }: { treatment: CalculationResult["lines"][number]["treatment"] }) {
  const map: Record<typeof treatment, { label: string; color: string }> = {
    taxable: { label: "Taxable", color: "var(--color-fg-secondary)" },
    exempt_with_credit: { label: "Zero-rated", color: "var(--color-success)" },
    exempt_without_credit: { label: "Exempt", color: "var(--color-fg-secondary)" },
    reverse_charge: { label: "Reverse charge", color: "var(--color-accent-blue)" },
    not_subject: { label: "Not subject", color: "var(--color-fg-tertiary)" },
  };
  const { label, color } = map[treatment];
  return (
    <span
      className="inline-flex items-center text-[11px] px-1.5 py-0.5 rounded border"
      style={{ color, borderColor: "var(--color-separator)" }}
    >
      {label}
    </span>
  );
}
