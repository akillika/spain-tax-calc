/**
 * Spain Tax Engine — domain types.
 *
 * The engine is pure TS, runs in browser or server. No framework deps.
 * Inputs and outputs are JSON-serializable so calculations can be cached,
 * audited, and replayed deterministically.
 */

export type Region =
  | "mainland"
  | "balearic"
  | "canary"
  | "ceuta"
  | "melilla"
  | "pais_vasco"
  | "navarra";

export type Regime =
  | "general"
  | "equivalence_surcharge"
  | "reagp"
  | "rebu"
  | "travel_agency"
  | "simplified"
  | "group"
  | "cash_basis"
  | "investment_gold";

export type OperationType =
  | "goods_supply"
  | "services_supply"
  | "intra_eu_acquisition"
  | "import"
  | "export"
  | "self_supply"
  | "free_supply"
  | "advance_payment"
  | "bad_debt_recovery";

export type PartyType = "business" | "consumer" | "public_admin" | "exempt_entity";

export type TaxCode = "IVA" | "IGIC" | "IPSI" | "NONE";

export type TaxAuthority =
  | "AEAT"
  | "Bizkaia"
  | "Gipuzkoa"
  | "Alava"
  | "Navarra"
  | "ATC" // Agencia Tributaria Canaria
  | "Ceuta"
  | "Melilla";

export type Treatment =
  | "taxable"
  | "exempt_with_credit"
  | "exempt_without_credit"
  | "reverse_charge"
  | "not_subject";

export interface Party {
  nif?: string;
  vatId?: string;
  country: string; // ISO 3166-1 alpha-2
  region?: Region;
  type?: PartyType;
  viesValidatedAt?: string; // ISO timestamp
  subjectToEquivalenceSurcharge?: boolean;
}

export interface Seller extends Party {
  regime: Regime;
  siiObligated?: boolean;
  ossRegistered?: boolean;
  iossRegistered?: boolean;
  verifactuEnabled?: boolean;
}

export interface Discount {
  type: "commercial" | "financial" | "post_invoice";
  amount: number; // positive number, in transaction currency
}

export interface ExciseInfo {
  category: "alcohol" | "tobacco" | "hydrocarbons" | "electricity" | "coal";
  /** Optional unit-based quantity (litres of pure alcohol, kg of tobacco, etc.) */
  quantityForExcise?: number;
}

export interface IedmtInfo {
  /** Vehicle CO2 emissions in g/km */
  co2gPerKm: number;
  /** Whether the vehicle qualifies for technical exemption (e.g. taxis, disability adapted) */
  technicalExemption?: boolean;
}

export interface Line {
  /** Free-text description as the user would write on an invoice. AI uses this. */
  description: string;
  /** Hierarchical category code (e.g. "food.basic.bread"). May be set by AI or manually. */
  category?: string;
  /** Optional CNAE / CPV reporting codes. */
  cnae?: string;
  cpv?: string;
  quantity: number;
  unitPriceNet: number;
  discount?: Discount;
  excise?: ExciseInfo;
  iedmt?: IedmtInfo;
  /** Hint flags from AI classification. Engine reads these as inputs to determination logic. */
  hints?: ClassificationHints;
}

export interface ClassificationHints {
  /* Goods / consumables */
  isAlcoholic?: boolean;
  isTobacco?: boolean;
  isBasicFood?: boolean;
  isMedicineForHumanUse?: boolean;
  isVeterinaryMedicine?: boolean;
  isBookOrPeriodical?: boolean;
  isWaterSupply?: boolean;
  isFlowerOrPlant?: boolean;
  isAgriculturalInput?: boolean; // seeds, fertilizers, pesticides
  isAgricultureProduct?: boolean; // REAGP supplier-side
  isSanitaryProduct?: boolean;
  isFeminineHygieneProduct?: boolean;
  isPreciousMetal?: boolean;
  isInvestmentGold?: boolean;
  isEmissionRight?: boolean;
  isEnergyCertificate?: boolean;
  isElectronicDeviceOver10k?: boolean;
  isScrap?: boolean;
  isUsedGoods?: boolean;
  isVehicleForDisability?: boolean;
  isVehicleRegistration?: boolean;

  /* Services */
  isHospitality?: boolean;
  isPassengerTransport?: boolean;
  isCulturalEvent?: boolean;
  isCulturalServicePublic?: boolean; // exempt under Art. 20.Uno.14.º
  isSportsServiceNonProfit?: boolean;
  isHealthcareService?: boolean;
  isEducationService?: boolean;
  isFinancialService?: boolean;
  isInsurance?: boolean;
  isPostalService?: boolean;
  isLotteryOrBetting?: boolean;
  isSocialServiceNonProfit?: boolean;
  isNonProfitMembership?: boolean; // dues to unions, political parties, religious bodies
  isDigitalService?: boolean;
  isTelecomBroadcast?: boolean;
  isConstructionServiceB2B?: boolean;
  isHairdressing?: boolean;
  isDisabledAssistanceService?: boolean;

  /* Real estate */
  isRealEstateRelated?: boolean;
  realEstateLocation?: { country: string; region?: Region };
  isRentalDwelling?: boolean;
  isRentalCommercial?: boolean;
  isFirstTransmissionDwelling?: boolean;
  isSecondTransmissionBuilding?: boolean;
  isLandSale?: boolean;
  isSocialHousingVPO?: boolean;
  isVATWaiverApplied?: boolean; // Art. 20.Dos waiver elected → reverse charge

  /* Audit */
  rationale?: string;
  confidence?: number;
}

export interface Triangulation {
  role: "intermediary" | "supplier" | "final";
  otherCountry: string;
}

export interface Transaction {
  /** Date of devengo. Drives which dated rule version applies. ISO date (YYYY-MM-DD). */
  operationDate: string;
  operationType: OperationType;
  seller: Seller;
  buyer: Party;
  lines: Line[];
  currency: string; // ISO 4217 (default EUR)
  isNewMeansOfTransport?: boolean;
  triangulation?: Triangulation;
  invoiceType?: "full" | "simplified" | "rectifying" | "recapitulative" | "self_billed";
}

/* ----------------------------------------------------------------------- */
/* Rules                                                                    */
/* ----------------------------------------------------------------------- */

/** Where a rule is in force. ES.* covers Spanish jurisdictions. */
export type Jurisdiction =
  | "ES.mainland"
  | "ES.balearic"
  | "ES.canary"
  | "ES.ceuta"
  | "ES.melilla"
  | "ES.pais_vasco"
  | "ES.navarra"
  | "ES" // any Spanish jurisdiction
  | "EU" // any EU member
  | "ROW"; // rest of world

export interface RulePredicate {
  operationType?: OperationType[];
  taxCode?: TaxCode[];
  /** Match transaction.lines[i].category by exact value or prefix (e.g. "food.basic"). */
  categoryIn?: string[];
  categoryPrefix?: string[];
  /** Match against ClassificationHints flags. All listed flags must be true. */
  requireHints?: (keyof ClassificationHints)[];
  /** Match against ClassificationHints flags. All listed flags must be false. */
  forbidHints?: (keyof ClassificationHints)[];
  buyerType?: PartyType[];
  buyerCountryIn?: string[];
  buyerCountryNotIn?: string[];
  buyerRegionIn?: Region[];
  sellerRegionIn?: Region[];
  sellerRegimeIn?: Regime[];
  /** Place of supply must equal one of these jurisdictions. */
  placeOfSupplyIn?: Jurisdiction[];
}

export interface RuleResult {
  ratePercent?: number;
  treatment?: Treatment;
  /** For equivalence surcharge rules. */
  surchargePercent?: number;
  /** Mandatory invoice mention emitted by this rule (Spanish). */
  invoiceMention?: string;
}

export interface Rule {
  id: string;
  jurisdiction: Jurisdiction;
  taxCode: TaxCode;
  effectiveFrom: string; // ISO date
  effectiveTo?: string | null;
  /** Higher priority wins on tie. Default 100. Suggest 1000 for surcharge / 200 for specials / 100 for general / 10 for fallback. */
  priority?: number;
  source: string[]; // BOE references, article numbers
  applies: RulePredicate;
  result: RuleResult;
  notes?: string;
}

export interface AppliedRule {
  ruleId: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  source: string[];
  reasoning: string;
}

/* ----------------------------------------------------------------------- */
/* Output                                                                   */
/* ----------------------------------------------------------------------- */

export interface PlaceOfSupply {
  country: string;
  region?: Region;
  jurisdiction: Jurisdiction;
  reason: string; // human-readable explanation
}

export interface LineResult {
  description: string;
  category?: string;
  net: number;
  taxableBase: number;
  taxCode: TaxCode;
  ratePercent: number;
  taxAmount: number;
  equivalenceSurchargePercent?: number;
  equivalenceSurchargeAmount?: number;
  excise?: { category: string; amount: number };
  iedmt?: { ratePercent: number; amount: number };
  treatment: Treatment;
  placeOfSupply: PlaceOfSupply;
  appliedRules: AppliedRule[];
  warnings: string[];
  total: number;
}

export interface CalculationTotals {
  net: number;
  tax: number;
  surcharge: number;
  excise: number;
  iedmt: number;
  total: number;
}

export interface CalculationResult {
  /** Hash of (transaction + rules-set + prompt-version). Same hash → same result. */
  fingerprint: string;
  rulesVersion: string;
  promptVersion: string;
  taxAuthority: TaxAuthority;
  lines: LineResult[];
  totals: CalculationTotals;
  invoiceMentions: string[];
  warnings: string[];
}
