/**
 * AI classifier — turns a free-text line description + transaction context
 * into a structured ClassificationHints object that the deterministic engine
 * consumes.
 *
 * Design constraints:
 *   - Browser-side: user pastes their OpenAI key, key never leaves the browser.
 *   - Reproducible: temperature=0, fixed seed, prompt version recorded in cache key.
 *   - Cached: localStorage keyed by sha256 of (description + context + prompt).
 *   - Structured output: OpenAI `response_format: json_schema` with strict=true so
 *     the model literally cannot return an invalid shape.
 *   - Graceful: if no key or network fails, caller falls back to manual category pick.
 */

import type { ClassificationHints, Region } from "@/lib/engine/types";

export const CLASSIFIER_PROMPT_VERSION = "classifier-v3";
export const DEFAULT_MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT = `You are a Spanish indirect-tax classification assistant.

Given a free-text description of a single line on a Spanish invoice and basic
transaction context, output structured boolean hints that a deterministic tax
engine will use to pick the correct rule.

Set ONLY the flags that apply. Provide a one-sentence rationale and a confidence
score (0..1). When uncertain, lower confidence. Default to false for ambiguous
flags — the engine's fallback is the general rate, so false negatives are safer
than false positives.

CRITICAL: Your rationale must describe WHAT the item is, NOT what tax rate applies.
- DO NOT mention rate percentages (4%, 10%, 21%, etc.).
- DO NOT name a tax (IVA, IGIC, IPSI) — you don't know which jurisdiction applies;
  that is determined by the deterministic engine after you classify.
- DO NOT cite legal articles or BOE references.
- DO describe the nature/category of the good or service in plain language.

Good rationale: "Wholemeal bread loaf, a staple foodstuff."
Bad rationale: "Wholemeal bread, eligible for super-reduced 4% IVA under Art. 91.Dos.1.1.º."

GOODS:
- "isBasicFood": staple foodstuffs eligible for super-reduced 4% IVA (bread, milk,
  cheese, eggs, fruit, vegetables, legumes, tubers, cereals, flour). NOT prepared
  meals, NOT alcoholic, NOT confectionery, NOT branded snacks.
- "isAlcoholic": the item itself contains alcohol for consumption.
- "isTobacco": manufactured tobacco product.
- "isMedicineForHumanUse": medicines authorized by AEMPS for human use.
- "isVeterinaryMedicine": animal medicines.
- "isBookOrPeriodical": books, newspapers, magazines, incl. digital editions.
- "isWaterSupply": potable water supply (bottled or piped).
- "isFlowerOrPlant": cut flowers, ornamental plants, bulbs.
- "isAgriculturalInput": seeds, fertilizers, pesticides, animal feed.
- "isAgricultureProduct": REAGP supplier-side (raw farm output sold by farmer).
- "isSanitaryProduct": gauze, bandages, hygiene tampons (basic), prosthetics,
  orthopedic devices, diabetes/disability aids; reduced 10% category.
- "isFeminineHygieneProduct": pads, tampons, panty liners, menstrual cups,
  contraceptives — super-reduced 4% since 2023.
- "isPreciousMetal": gold/silver bullion or industrial precious metal.
- "isInvestmentGold": gold meeting Art. 140 fineness/form criteria.
- "isEmissionRight": greenhouse-gas emission allowances (EU ETS).
- "isEnergyCertificate": gas/electricity supply certificates from non-resident.
- "isElectronicDeviceOver10k": mobile phones, tablets, laptops, consoles where
  total invoice exceeds €10,000 to a business buyer.
- "isScrap": recovered metal/plastic/paper materials.
- "isUsedGoods": second-hand items eligible for REBU margin scheme.
- "isVehicleForDisability": vehicles adapted for or owned by a disabled person.
- "isVehicleRegistration": first registration of a vehicle subject to IEDMT.

SERVICES:
- "isHospitality": restaurant, bar, hotel, catering.
- "isPassengerTransport": transport of people (not freight).
- "isCulturalEvent": cultural / artistic / sporting events at reduced rate.
- "isCulturalServicePublic": cultural services by public bodies or non-profits
  (museum, library, cultural association) — exempt under Art. 20.Uno.14.º.
- "isSportsServiceNonProfit": sports services by non-profit clubs (Art. 20.Uno.13.º).
- "isHealthcareService": medical/clinical services (Art. 20.Uno.3.º).
- "isEducationService": regulated education (Art. 20.Uno.9.º).
- "isFinancialService": banking/lending (Art. 20.Uno.18.º).
- "isInsurance": insurance/reinsurance (Art. 20.Uno.16.º).
- "isPostalService": universal postal service (Art. 20.Uno.1.º).
- "isLotteryOrBetting": ONLOAE / ONCE / regulated betting (Art. 20.Uno.19.º).
- "isSocialServiceNonProfit": social/welfare services by non-profits
  (Art. 20.Uno.8.º).
- "isNonProfitMembership": dues to unions, political parties, religious bodies,
  professional/non-profit associations (Art. 20.Uno.12.º).
- "isDigitalService": electronically supplied services (SaaS, downloads, streaming).
- "isTelecomBroadcast": telecom or broadcasting services.
- "isConstructionServiceB2B": execution of works on real-estate construction or
  rehabilitation when both parties are businesses (Art. 84.Uno.2.º.f).
- "isHairdressing": hairdressing services.
- "isDisabledAssistanceService": personal assistance for disabled persons
  (super-reduced 4% under Art. 91.Dos.2.3.º).

REAL ESTATE:
- "isRealEstateRelated": service intrinsically tied to a specific property
  (architect, surveyor, real-estate agent, accommodation, on-site construction).
  If true, populate realEstateLocation.
- "isRentalDwelling": lease of property used as a permanent dwelling (exempt).
- "isRentalCommercial": lease of premises used for business purposes (21%).
- "isFirstTransmissionDwelling": first sale by promoter of a new dwelling (10%).
- "isSecondTransmissionBuilding": resale of an existing building (exempt → ITP).
- "isLandSale": transfer of undeveloped land (generally exempt Art. 20.Uno.20.º).
- "isSocialHousingVPO": dwelling under Vivienda de Protección Oficial (4%).
- "isVATWaiverApplied": Art. 20.Dos waiver applied — second transmission becomes
  taxable AND triggers reverse charge under Art. 84.Uno.2.º.e.`;

const HINT_BOOLEAN_KEYS = [
  // Goods
  "isAlcoholic",
  "isTobacco",
  "isBasicFood",
  "isMedicineForHumanUse",
  "isVeterinaryMedicine",
  "isBookOrPeriodical",
  "isWaterSupply",
  "isFlowerOrPlant",
  "isAgriculturalInput",
  "isAgricultureProduct",
  "isSanitaryProduct",
  "isFeminineHygieneProduct",
  "isPreciousMetal",
  "isInvestmentGold",
  "isEmissionRight",
  "isEnergyCertificate",
  "isElectronicDeviceOver10k",
  "isScrap",
  "isUsedGoods",
  "isVehicleForDisability",
  "isVehicleRegistration",
  // Services
  "isHospitality",
  "isPassengerTransport",
  "isCulturalEvent",
  "isCulturalServicePublic",
  "isSportsServiceNonProfit",
  "isHealthcareService",
  "isEducationService",
  "isFinancialService",
  "isInsurance",
  "isPostalService",
  "isLotteryOrBetting",
  "isSocialServiceNonProfit",
  "isNonProfitMembership",
  "isDigitalService",
  "isTelecomBroadcast",
  "isConstructionServiceB2B",
  "isHairdressing",
  "isDisabledAssistanceService",
  // Real estate
  "isRealEstateRelated",
  "isRentalDwelling",
  "isRentalCommercial",
  "isFirstTransmissionDwelling",
  "isSecondTransmissionBuilding",
  "isLandSale",
  "isSocialHousingVPO",
  "isVATWaiverApplied",
] as const;

const HINTS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    category: {
      type: "string",
      description:
        "Hierarchical category code, e.g. 'food.basic.bread' or 'services.healthcare.consultation'.",
    },
    ...Object.fromEntries(HINT_BOOLEAN_KEYS.map((k) => [k, { type: "boolean" }])),
    realEstateLocation: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          properties: {
            country: { type: "string" },
            region: {
              type: "string",
              enum: ["mainland", "balearic", "canary", "ceuta", "melilla", "pais_vasco", "navarra"],
            },
          },
          required: ["country", "region"],
        },
        { type: "null" },
      ],
    },
    rationale: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: [
    "category",
    ...HINT_BOOLEAN_KEYS,
    "realEstateLocation",
    "rationale",
    "confidence",
  ],
} as const;

export interface ClassifierContext {
  operationType: string;
  buyerCountry: string;
  buyerRegion?: Region;
  buyerType?: string;
  sellerRegion?: Region;
  unitPriceNet: number;
  quantity: number;
  invoiceTotal: number;
}

export interface ClassifierResult {
  hints: ClassificationHints & { category?: string };
  cached: boolean;
}

/**
 * Classify a single line. Returns hints + category. Caller may persist the
 * category onto the line so subsequent edits don't re-trigger the LLM.
 */
export async function classifyLine(opts: {
  description: string;
  context: ClassifierContext;
  apiKey: string;
  model?: string;
  signal?: AbortSignal;
}): Promise<ClassifierResult> {
  const { description, context, apiKey, signal } = opts;
  const model = opts.model ?? DEFAULT_MODEL;

  const cacheKey = await buildCacheKey(description, context, model);
  const cached = readCache(cacheKey);
  if (cached) return { hints: cached, cached: true };

  const userMessage = JSON.stringify(
    {
      description,
      context: {
        operation: context.operationType,
        buyer: { country: context.buyerCountry, region: context.buyerRegion ?? null, type: context.buyerType ?? null },
        seller: { region: context.sellerRegion ?? null },
        unitPriceNetEur: context.unitPriceNet,
        quantity: context.quantity,
        invoiceTotalEur: context.invoiceTotal,
      },
    },
    null,
    2,
  );

  const body = {
    model,
    temperature: 0,
    seed: 42,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "classification_hints",
        schema: HINTS_SCHEMA,
        strict: true,
      },
    },
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenAI request failed (${res.status}): ${errText.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned empty content.");

  let hints: ClassificationHints & { category?: string };
  try {
    hints = JSON.parse(content);
  } catch {
    throw new Error("OpenAI structured-output payload was not valid JSON.");
  }

  writeCache(cacheKey, hints);
  return { hints, cached: false };
}

/* --------------------------------------------------------------------- */
/* Cache (localStorage, browser-only)                                     */
/* --------------------------------------------------------------------- */

const CACHE_PREFIX = "spain-tax:classify:";

function readCache(key: string): (ClassificationHints & { category?: string }) | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + key);
    return raw ? (JSON.parse(raw) as ClassificationHints & { category?: string }) : undefined;
  } catch {
    return undefined;
  }
}

function writeCache(key: string, hints: ClassificationHints & { category?: string }): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(hints));
  } catch {
    // Quota exceeded — silently drop. Next call will re-fetch.
  }
}

async function buildCacheKey(
  description: string,
  ctx: ClassifierContext,
  model: string,
): Promise<string> {
  const payload = JSON.stringify({
    v: CLASSIFIER_PROMPT_VERSION,
    m: model,
    d: description.trim().toLowerCase(),
    c: ctx,
  });
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = new TextEncoder().encode(payload);
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Server-render fallback: not used in practice, but keeps types happy.
  return payload;
}
