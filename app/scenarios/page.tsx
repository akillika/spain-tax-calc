import { calculate } from "@/lib/engine";
import type { Transaction } from "@/lib/engine/types";

/**
 * Scenario matrix — runs the engine against curated test cases at build/render
 * time and renders results. This is both a verification harness and living
 * documentation of what the engine handles correctly.
 */

type Scenario = {
  name: string;
  expect: { rate: number; treatment: string; rule?: string };
  tx: Transaction;
};

const today = "2026-04-29";

function base(): Transaction {
  return {
    operationDate: today,
    operationType: "goods_supply",
    currency: "EUR",
    seller: {
      country: "ES",
      region: "mainland",
      regime: "general",
      type: "business",
      nif: "B12345678",
    },
    buyer: { country: "ES", region: "mainland", type: "business", nif: "A87654321" },
    lines: [{ description: "—", quantity: 1, unitPriceNet: 100, hints: {} }],
  };
}

const SCENARIOS: Scenario[] = [
  {
    name: "Domestic B2B — generic goods → 21%",
    expect: { rate: 21, treatment: "taxable", rule: "iva.rate.21.general" },
    tx: base(),
  },
  {
    name: "Domestic B2C — generic goods → 21%",
    expect: { rate: 21, treatment: "taxable", rule: "iva.rate.21.general" },
    tx: { ...base(), buyer: { country: "ES", region: "mainland", type: "consumer" } },
  },
  {
    name: "Basic food (bread) → 4% super-reduced",
    expect: { rate: 4, treatment: "taxable", rule: "iva.rate.4.basic_food" },
    tx: {
      ...base(),
      lines: [
        {
          description: "pan integral 500g",
          quantity: 1,
          unitPriceNet: 100,
          hints: { isBasicFood: true },
        },
      ],
    },
  },
  {
    name: "Books → 4% super-reduced",
    expect: { rate: 4, treatment: "taxable", rule: "iva.rate.4.books_periodicals" },
    tx: {
      ...base(),
      lines: [
        {
          description: "novela tapa blanda",
          quantity: 1,
          unitPriceNet: 100,
          hints: { isBookOrPeriodical: true },
        },
      ],
    },
  },
  {
    name: "Medicine for human use → 4% super-reduced",
    expect: { rate: 4, treatment: "taxable", rule: "iva.rate.4.medicines_human" },
    tx: {
      ...base(),
      lines: [
        {
          description: "ibuprofeno 600mg",
          quantity: 1,
          unitPriceNet: 100,
          hints: { isMedicineForHumanUse: true },
        },
      ],
    },
  },
  {
    name: "Hospitality (restaurant) → 10% reduced",
    expect: { rate: 10, treatment: "taxable", rule: "iva.rate.10.hospitality" },
    tx: {
      ...base(),
      operationType: "services_supply",
      lines: [
        {
          description: "menú del día",
          quantity: 1,
          unitPriceNet: 100,
          hints: { isHospitality: true },
        },
      ],
    },
  },
  {
    name: "Passenger transport → 10% reduced",
    expect: { rate: 10, treatment: "taxable", rule: "iva.rate.10.passenger_transport" },
    tx: {
      ...base(),
      operationType: "services_supply",
      lines: [
        {
          description: "billete tren Madrid-Barcelona",
          quantity: 1,
          unitPriceNet: 100,
          hints: { isPassengerTransport: true },
        },
      ],
    },
  },
  {
    name: "First-transmission dwelling → 10% reduced",
    expect: { rate: 10, treatment: "taxable", rule: "iva.rate.10.first_dwelling_transmission" },
    tx: {
      ...base(),
      lines: [
        {
          description: "vivienda nueva",
          quantity: 1,
          unitPriceNet: 100,
          hints: { isFirstTransmissionDwelling: true },
        },
      ],
    },
  },
  {
    name: "Healthcare service → exempt (Art. 20.Uno.3.º)",
    expect: { rate: 0, treatment: "exempt_without_credit", rule: "iva.exempt.healthcare" },
    tx: {
      ...base(),
      operationType: "services_supply",
      lines: [
        {
          description: "consulta médica",
          quantity: 1,
          unitPriceNet: 100,
          hints: { isHealthcareService: true },
        },
      ],
    },
  },
  {
    name: "Education service → exempt (Art. 20.Uno.9.º)",
    expect: { rate: 0, treatment: "exempt_without_credit", rule: "iva.exempt.education" },
    tx: {
      ...base(),
      operationType: "services_supply",
      lines: [
        {
          description: "clase regulada",
          quantity: 1,
          unitPriceNet: 100,
          hints: { isEducationService: true },
        },
      ],
    },
  },
  {
    name: "Residential rental → exempt",
    expect: { rate: 0, treatment: "exempt_without_credit", rule: "iva.exempt.residential_rental" },
    tx: {
      ...base(),
      operationType: "services_supply",
      lines: [
        {
          description: "alquiler vivienda habitual",
          quantity: 1,
          unitPriceNet: 100,
          hints: { isRentalDwelling: true },
        },
      ],
    },
  },
  {
    name: "Construction service B2B → reverse charge",
    expect: { rate: 0, treatment: "reverse_charge", rule: "iva.rc.construction_b2b" },
    tx: {
      ...base(),
      operationType: "services_supply",
      lines: [
        {
          description: "ejecución de obra de rehabilitación",
          quantity: 1,
          unitPriceNet: 100,
          hints: { isConstructionServiceB2B: true },
        },
      ],
    },
  },
  {
    name: "Scrap supply B2B → reverse charge",
    expect: { rate: 0, treatment: "reverse_charge", rule: "iva.rc.scrap" },
    tx: {
      ...base(),
      lines: [
        {
          description: "chatarra metálica",
          quantity: 1,
          unitPriceNet: 100,
          hints: { isScrap: true },
        },
      ],
    },
  },
  {
    name: "Intra-EU B2B goods (FR, VIES validated) → zero-rated",
    expect: { rate: 0, treatment: "exempt_with_credit", rule: "iva.zero.intra_eu_goods_b2b" },
    tx: {
      ...base(),
      buyer: {
        country: "FR",
        vatId: "FR12345678901",
        type: "business",
        viesValidatedAt: today,
      },
    },
  },
  {
    name: "Intra-EU B2B goods missing VIES → zero-rated with warning",
    expect: { rate: 0, treatment: "exempt_with_credit", rule: "iva.zero.intra_eu_goods_b2b" },
    tx: {
      ...base(),
      buyer: { country: "FR", vatId: "FR12345678901", type: "business" },
    },
  },
  {
    name: "Export of goods to US → zero-rated",
    expect: { rate: 0, treatment: "exempt_with_credit", rule: "iva.zero.export_goods" },
    tx: { ...base(), operationType: "export", buyer: { country: "US", type: "business" } },
  },
  {
    name: "Sale to Canary Islands → zero-rated (export)",
    expect: { rate: 0, treatment: "exempt_with_credit", rule: "iva.zero.export_to_special_territories" },
    tx: { ...base(), buyer: { country: "ES", region: "canary", type: "business" } },
  },
  {
    name: "Sale to Ceuta → zero-rated (export)",
    expect: { rate: 0, treatment: "exempt_with_credit", rule: "iva.zero.export_to_special_territories" },
    tx: { ...base(), buyer: { country: "ES", region: "ceuta", type: "business" } },
  },
  {
    name: "Equivalence surcharge — wholesaler→retailer (general 21%) → +5.2%",
    expect: { rate: 21, treatment: "taxable", rule: "iva.rate.21.general" },
    tx: {
      ...base(),
      buyer: {
        country: "ES",
        region: "mainland",
        type: "business",
        subjectToEquivalenceSurcharge: true,
      },
    },
  },
  {
    name: "Sale within Canary Islands → IGIC 7% general",
    expect: { rate: 7, treatment: "taxable", rule: "igic.rate.7.general" },
    tx: {
      ...base(),
      seller: { ...base().seller, region: "canary" },
      buyer: { country: "ES", region: "canary", type: "business" },
    },
  },
  {
    name: "Sale within Ceuta → IPSI ~4%",
    expect: { rate: 4, treatment: "taxable", rule: "ipsi.ceuta.general" },
    tx: {
      ...base(),
      seller: { ...base().seller, region: "ceuta" },
      buyer: { country: "ES", region: "ceuta", type: "business" },
    },
  },
];

function runScenario(s: Scenario) {
  try {
    const r = calculate(s.tx);
    const line = r.lines[0];
    const got = {
      rate: line.ratePercent,
      treatment: line.treatment,
      rule: line.appliedRules[0]?.ruleId,
      tax: line.taxAmount,
      surcharge: line.equivalenceSurchargeAmount ?? 0,
      total: r.totals.total,
      authority: r.taxAuthority,
      placeReason: line.placeOfSupply.reason,
      warnings: [...line.warnings, ...r.warnings],
      sources: line.appliedRules.flatMap((ar) => ar.source),
    };
    const pass =
      got.rate === s.expect.rate &&
      got.treatment === s.expect.treatment &&
      (s.expect.rule == null || got.rule === s.expect.rule);
    return { pass, got, error: null as string | null };
  } catch (e) {
    return { pass: false, got: null, error: (e as Error).message };
  }
}

export default function ScenariosPage() {
  const results = SCENARIOS.map((s) => ({ s, r: runScenario(s) }));
  const passed = results.filter((x) => x.r.pass).length;

  return (
    <div className="min-h-screen">
      <header
        className="sticky top-0 z-10 backdrop-blur"
        style={{
          background: "color-mix(in oklab, var(--color-bg) 80%, transparent)",
          borderBottom: "1px solid var(--color-separator-soft)",
        }}
      >
        <div className="px-6 py-3 flex items-center gap-4">
          <h1 className="text-[15px] font-semibold tracking-tight">
            Spain Tax — Scenario matrix
          </h1>
          <span className="text-[11px] text-[color:var(--color-fg-tertiary)]">
            <span className="num">{passed}</span> /{" "}
            <span className="num">{results.length}</span> passing
          </span>
          <div className="flex-1" />
          <a className="btn btn-ghost" href="/">
            ← Calculator
          </a>
        </div>
      </header>
      <div className="p-6 space-y-3 max-w-5xl">
        {results.map(({ s, r }, i) => (
          <div
            key={i}
            className="border rounded-lg p-3"
            style={{
              borderColor: r.pass
                ? "var(--color-separator-soft)"
                : "var(--color-danger)",
            }}
          >
            <div className="flex items-center gap-3">
              <span
                className="text-[11px] num px-1.5 py-0.5 rounded"
                style={{
                  background: r.pass ? "var(--color-surface-2)" : "var(--color-danger)",
                  color: r.pass ? "var(--color-success)" : "white",
                }}
              >
                {r.pass ? "PASS" : "FAIL"}
              </span>
              <div className="text-[14px] font-medium">{s.name}</div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-[12px]">
              <div className="text-[color:var(--color-fg-secondary)]">
                expect:{" "}
                <span className="num">{s.expect.rate}%</span> {s.expect.treatment}
                {s.expect.rule ? (
                  <>
                    {" "}
                    <span className="cite">{s.expect.rule}</span>
                  </>
                ) : null}
              </div>
              <div className="text-[color:var(--color-fg-secondary)]">
                got:{" "}
                {r.error ? (
                  <span style={{ color: "var(--color-danger)" }}>{r.error}</span>
                ) : (
                  <>
                    <span className="num">{r.got!.rate}%</span> {r.got!.treatment}{" "}
                    <span className="cite">{r.got!.rule ?? "—"}</span>{" "}
                    <span className="num">€{r.got!.tax.toFixed(2)}</span> tax
                    {r.got!.surcharge > 0 && (
                      <>
                        {" "}+ <span className="num">€{r.got!.surcharge.toFixed(2)}</span> surcharge
                      </>
                    )}
                    {" · "}
                    <span className="num">€{r.got!.total.toFixed(2)}</span> total
                    {" · "}
                    {r.got!.authority}
                  </>
                )}
              </div>
              {r.got?.placeReason && (
                <div className="col-span-2 text-[11px] text-[color:var(--color-fg-tertiary)]">
                  {r.got.placeReason}
                </div>
              )}
              {r.got?.sources && r.got.sources.length > 0 && (
                <div className="col-span-2 flex flex-wrap gap-1">
                  {r.got.sources.map((src) => (
                    <span key={src} className="cite">
                      {src}
                    </span>
                  ))}
                </div>
              )}
              {r.got?.warnings && r.got.warnings.length > 0 && (
                <div className="col-span-2 text-[11px]" style={{ color: "var(--color-warning)" }}>
                  {r.got.warnings.join(" / ")}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
