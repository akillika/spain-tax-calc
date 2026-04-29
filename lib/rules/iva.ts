import type { Rule } from "@/lib/engine/types";

/**
 * IVA bootstrap rule set — Ley 37/1992 (LIVA) + RD 1624/1992.
 *
 * Rules are evaluated in priority order (highest first).
 * Each rule's `applies` predicate is matched against the resolved transaction
 * (after place-of-supply has been determined). On tie, a hard error surfaces:
 * rules MUST be unambiguous.
 *
 * Citation discipline: every rule has at least one `source[]` entry referencing
 * the LIVA article and (where applicable) the BOE publication. CI verifies this.
 *
 * NOTE: This is the manually-curated bootstrap set. The LLM-drafted update
 * pipeline (Phase 1.5) appends/supersedes via dated entries — never edits in
 * place. Old rules retain their `effectiveTo` date so historical recalculations
 * remain reproducible.
 */
/* Helper — a rule applies in mainland + Balearics by default. */
const PENINSULA: Rule["jurisdiction"][] = ["ES.mainland", "ES.balearic"];

export const IVA_RULES: Rule[] = [
  /* ------------------------------------------------------------------- */
  /* REVERSE CHARGE — Art. 84.Uno.2.º (priority 1000)                      */
  /* ------------------------------------------------------------------- */

  // (b) Investment gold (Art. 140 ter — full reverse charge for B2B supplies of gold).
  {
    id: "iva.rc.investment_gold",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "1999-01-01",
    priority: 1000,
    source: ["Ley 37/1992 Art. 84.Uno.2.º.b", "Art. 140 ter LIVA"],
    applies: {
      operationType: ["goods_supply"],
      requireHints: ["isInvestmentGold"],
      buyerType: ["business"],
      placeOfSupplyIn: PENINSULA,
    },
    result: {
      treatment: "reverse_charge",
      ratePercent: 0,
      invoiceMention: "Inversión del sujeto pasivo — oro de inversión (Art. 84.Uno.2.º.b LIVA).",
    },
  },

  // (b modified) Precious metals (semi-finished gold and silver).
  {
    id: "iva.rc.precious_metals",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "2014-04-01",
    priority: 1000,
    source: ["Ley 37/1992 Art. 84.Uno.2.º.b", "BOE-A-2014-3168"],
    applies: {
      operationType: ["goods_supply"],
      requireHints: ["isPreciousMetal"],
      forbidHints: ["isInvestmentGold"],
      buyerType: ["business"],
      placeOfSupplyIn: PENINSULA,
    },
    result: {
      treatment: "reverse_charge",
      ratePercent: 0,
      invoiceMention: "Inversión del sujeto pasivo — metales preciosos (Art. 84.Uno.2.º.b LIVA).",
    },
  },

  // (c) Scrap and recovered materials.
  {
    id: "iva.rc.scrap",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "2004-01-01",
    priority: 1000,
    source: ["Ley 37/1992 Art. 84.Uno.2.º.c"],
    applies: {
      operationType: ["goods_supply"],
      requireHints: ["isScrap"],
      buyerType: ["business"],
      placeOfSupplyIn: PENINSULA,
    },
    result: {
      treatment: "reverse_charge",
      ratePercent: 0,
      invoiceMention: "Inversión del sujeto pasivo (Art. 84.Uno.2.º.c LIVA).",
    },
  },

  // (d) Greenhouse-gas emission rights.
  {
    id: "iva.rc.emission_rights",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "2010-08-14",
    priority: 1000,
    source: ["Ley 37/1992 Art. 84.Uno.2.º.d", "BOE-A-2010-12936"],
    applies: {
      operationType: ["services_supply", "goods_supply"],
      requireHints: ["isEmissionRight"],
      buyerType: ["business"],
      placeOfSupplyIn: PENINSULA,
    },
    result: {
      treatment: "reverse_charge",
      ratePercent: 0,
      invoiceMention: "Inversión del sujeto pasivo — derechos de emisión (Art. 84.Uno.2.º.d LIVA).",
    },
  },

  // (e) Real-estate transmissions when Art. 20.Dos waiver is applied.
  {
    id: "iva.rc.real_estate_with_waiver",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "2012-10-31",
    priority: 1000,
    source: ["Ley 37/1992 Art. 84.Uno.2.º.e", "BOE-A-2012-13416"],
    applies: {
      operationType: ["goods_supply"],
      requireHints: ["isVATWaiverApplied"],
      buyerType: ["business"],
      placeOfSupplyIn: PENINSULA,
    },
    result: {
      treatment: "reverse_charge",
      ratePercent: 0,
      invoiceMention: "Inversión del sujeto pasivo — renuncia a la exención (Art. 84.Uno.2.º.e LIVA).",
    },
    notes: "Buyer self-assesses 21%. Triggered by waiver of Art. 20.Uno.20.º or 22.º exemption.",
  },

  // (f) Construction services B2B.
  {
    id: "iva.rc.construction_b2b",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "2012-10-31",
    priority: 1000,
    source: ["Ley 37/1992 Art. 84.Uno.2.º.f", "BOE-A-2012-13416"],
    applies: {
      operationType: ["services_supply"],
      requireHints: ["isConstructionServiceB2B"],
      buyerType: ["business"],
      placeOfSupplyIn: PENINSULA,
    },
    result: {
      treatment: "reverse_charge",
      ratePercent: 0,
      invoiceMention: "Inversión del sujeto pasivo (Art. 84.Uno.2.º.f LIVA).",
    },
    notes: "Execution of works on real-estate construction or rehabilitation between businesses.",
  },

  // (g) Electronic devices > €10k B2B.
  {
    id: "iva.rc.electronics_over_10k",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "2014-04-01",
    priority: 1000,
    source: ["Ley 37/1992 Art. 84.Uno.2.º.g", "BOE-A-2014-3168"],
    applies: {
      operationType: ["goods_supply"],
      requireHints: ["isElectronicDeviceOver10k"],
      buyerType: ["business"],
      placeOfSupplyIn: PENINSULA,
    },
    result: {
      treatment: "reverse_charge",
      ratePercent: 0,
      invoiceMention: "Inversión del sujeto pasivo (Art. 84.Uno.2.º.g LIVA).",
    },
  },

  // (h) Gas / electricity supply certificates from non-resident.
  {
    id: "iva.rc.energy_certificates",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "2015-04-01",
    priority: 1000,
    source: ["Ley 37/1992 Art. 84.Uno.2.º.h"],
    applies: {
      operationType: ["goods_supply", "services_supply"],
      requireHints: ["isEnergyCertificate"],
      buyerType: ["business"],
      placeOfSupplyIn: PENINSULA,
    },
    result: {
      treatment: "reverse_charge",
      ratePercent: 0,
      invoiceMention: "Inversión del sujeto pasivo — certificados de gas/electricidad (Art. 84.Uno.2.º.h LIVA).",
    },
  },

  /* ------------------------------------------------------------------- */
  /* EXEMPTIONS — Art. 20.Uno (priority 900)                              */
  /* ------------------------------------------------------------------- */

  {
    id: "iva.exempt.postal",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "1993-01-01",
    priority: 900,
    source: ["Ley 37/1992 Art. 20.Uno.1.º"],
    applies: {
      operationType: ["services_supply"],
      requireHints: ["isPostalService"],
      placeOfSupplyIn: PENINSULA,
    },
    result: {
      treatment: "exempt_without_credit",
      ratePercent: 0,
      invoiceMention: "Operación exenta — servicio postal universal (Art. 20.Uno.1.º LIVA).",
    },
  },

  {
    id: "iva.exempt.healthcare",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "1993-01-01",
    priority: 900,
    source: ["Ley 37/1992 Art. 20.Uno.2.º y 3.º"],
    applies: {
      operationType: ["services_supply"],
      requireHints: ["isHealthcareService"],
      placeOfSupplyIn: PENINSULA,
    },
    result: {
      treatment: "exempt_without_credit",
      ratePercent: 0,
      invoiceMention: "Operación exenta (Art. 20.Uno.3.º LIVA).",
    },
  },

  {
    id: "iva.exempt.social_services",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "1993-01-01",
    priority: 900,
    source: ["Ley 37/1992 Art. 20.Uno.8.º"],
    applies: {
      operationType: ["services_supply"],
      requireHints: ["isSocialServiceNonProfit"],
      placeOfSupplyIn: PENINSULA,
    },
    result: {
      treatment: "exempt_without_credit",
      ratePercent: 0,
      invoiceMention: "Operación exenta — servicios sociales por entidad sin ánimo de lucro (Art. 20.Uno.8.º LIVA).",
    },
  },

  {
    id: "iva.exempt.education",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "1993-01-01",
    priority: 900,
    source: ["Ley 37/1992 Art. 20.Uno.9.º"],
    applies: {
      operationType: ["services_supply"],
      requireHints: ["isEducationService"],
      placeOfSupplyIn: PENINSULA,
    },
    result: {
      treatment: "exempt_without_credit",
      ratePercent: 0,
      invoiceMention: "Operación exenta (Art. 20.Uno.9.º LIVA).",
    },
  },

  {
    id: "iva.exempt.nonprofit_dues",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "1993-01-01",
    priority: 900,
    source: ["Ley 37/1992 Art. 20.Uno.12.º"],
    applies: {
      operationType: ["services_supply"],
      requireHints: ["isNonProfitMembership"],
      placeOfSupplyIn: PENINSULA,
    },
    result: {
      treatment: "exempt_without_credit",
      ratePercent: 0,
      invoiceMention: "Operación exenta — cuotas a entidades sin ánimo de lucro (Art. 20.Uno.12.º LIVA).",
    },
  },

  {
    id: "iva.exempt.sports_nonprofit",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "1993-01-01",
    priority: 900,
    source: ["Ley 37/1992 Art. 20.Uno.13.º"],
    applies: {
      operationType: ["services_supply"],
      requireHints: ["isSportsServiceNonProfit"],
      placeOfSupplyIn: PENINSULA,
    },
    result: {
      treatment: "exempt_without_credit",
      ratePercent: 0,
      invoiceMention: "Operación exenta — servicios deportivos por entidad no lucrativa (Art. 20.Uno.13.º LIVA).",
    },
  },

  {
    id: "iva.exempt.cultural_public",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "1993-01-01",
    priority: 900,
    source: ["Ley 37/1992 Art. 20.Uno.14.º"],
    applies: {
      operationType: ["services_supply"],
      requireHints: ["isCulturalServicePublic"],
      placeOfSupplyIn: PENINSULA,
    },
    result: {
      treatment: "exempt_without_credit",
      ratePercent: 0,
      invoiceMention: "Operación exenta — servicios culturales por entidad pública o no lucrativa (Art. 20.Uno.14.º LIVA).",
    },
  },

  {
    id: "iva.exempt.insurance",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "1993-01-01",
    priority: 900,
    source: ["Ley 37/1992 Art. 20.Uno.16.º"],
    applies: {
      operationType: ["services_supply"],
      requireHints: ["isInsurance"],
      placeOfSupplyIn: PENINSULA,
    },
    result: {
      treatment: "exempt_without_credit",
      ratePercent: 0,
      invoiceMention: "Operación exenta (Art. 20.Uno.16.º LIVA). Sujeto a IPS 8%.",
    },
    notes: "Insurance is IVA-exempt but subject to IPS (insurance premiums tax) at 8%.",
  },

  {
    id: "iva.exempt.financial",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "1993-01-01",
    priority: 900,
    source: ["Ley 37/1992 Art. 20.Uno.18.º"],
    applies: {
      operationType: ["services_supply"],
      requireHints: ["isFinancialService"],
      placeOfSupplyIn: PENINSULA,
    },
    result: {
      treatment: "exempt_without_credit",
      ratePercent: 0,
      invoiceMention: "Operación exenta (Art. 20.Uno.18.º LIVA).",
    },
  },

  {
    id: "iva.exempt.lottery",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "1993-01-01",
    priority: 900,
    source: ["Ley 37/1992 Art. 20.Uno.19.º"],
    applies: {
      requireHints: ["isLotteryOrBetting"],
      placeOfSupplyIn: PENINSULA,
    },
    result: {
      treatment: "exempt_without_credit",
      ratePercent: 0,
      invoiceMention: "Operación exenta — loterías y apuestas reguladas (Art. 20.Uno.19.º LIVA).",
    },
  },

  {
    id: "iva.exempt.land_sale",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "1993-01-01",
    priority: 900,
    source: ["Ley 37/1992 Art. 20.Uno.20.º"],
    applies: {
      operationType: ["goods_supply"],
      requireHints: ["isLandSale"],
      forbidHints: ["isVATWaiverApplied"],
      placeOfSupplyIn: PENINSULA,
    },
    result: {
      treatment: "exempt_without_credit",
      ratePercent: 0,
      invoiceMention: "Operación exenta — entrega de terreno rústico/no edificable (Art. 20.Uno.20.º LIVA). Tributa por ITP.",
    },
    notes: "Buyer routes via ITP (CCAA-specific rate) unless waiver applied.",
  },

  {
    id: "iva.exempt.second_building",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "1993-01-01",
    priority: 900,
    source: ["Ley 37/1992 Art. 20.Uno.22.º"],
    applies: {
      operationType: ["goods_supply"],
      requireHints: ["isSecondTransmissionBuilding"],
      forbidHints: ["isVATWaiverApplied"],
      placeOfSupplyIn: PENINSULA,
    },
    result: {
      treatment: "exempt_without_credit",
      ratePercent: 0,
      invoiceMention: "Operación exenta — segunda transmisión de edificación (Art. 20.Uno.22.º LIVA). Tributa por ITP/AJD.",
    },
    notes: "Buyer routes via ITP. If both parties are businesses with right to deduct, they may waive (Art. 20.Dos) → reverse charge.",
  },

  {
    id: "iva.exempt.residential_rental",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "1993-01-01",
    priority: 900,
    source: ["Ley 37/1992 Art. 20.Uno.23.º"],
    applies: {
      operationType: ["services_supply"],
      requireHints: ["isRentalDwelling"],
      placeOfSupplyIn: PENINSULA,
    },
    result: {
      treatment: "exempt_without_credit",
      ratePercent: 0,
      invoiceMention: "Arrendamiento de vivienda exento (Art. 20.Uno.23.º LIVA).",
    },
  },

  /* ------------------------------------------------------------------- */
  /* EXPORT / INTRA-EU — exempt with credit (zero-rated)                  */
  /* ------------------------------------------------------------------- */

  // Export of goods outside EU
  {
    id: "iva.zero.export_goods",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "1993-01-01",
    priority: 950,
    source: ["Ley 37/1992 Art. 21"],
    applies: {
      operationType: ["export"],
    },
    result: {
      treatment: "exempt_with_credit",
      ratePercent: 0,
      invoiceMention: "Operación exenta (Art. 21 LIVA — exportación).",
    },
  },

  // Intra-EU goods supply B2B with valid VAT ID
  {
    id: "iva.zero.intra_eu_goods_b2b",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "1993-01-01",
    priority: 950,
    source: ["Ley 37/1992 Art. 25", "Directive 2006/112/EC Art. 138"],
    applies: {
      operationType: ["goods_supply"],
      buyerType: ["business"],
      buyerCountryNotIn: ["ES"],
    },
    result: {
      treatment: "exempt_with_credit",
      ratePercent: 0,
      invoiceMention: "Entrega intracomunitaria exenta (Art. 25 LIVA).",
    },
    notes: "Requires VIES validation of buyer VAT ID and proof of intra-EU transport.",
  },

  // Sales from peninsula / Balearics to Canary / Ceuta / Melilla — treated as exports.
  // Predicate matches on the BUYER's region (special territory) while place of supply
  // remains the seller's mainland location.
  {
    id: "iva.zero.export_to_special_territories",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "1993-01-01",
    priority: 950,
    source: ["Ley 37/1992 Art. 21.1.º"],
    applies: {
      operationType: ["goods_supply"],
      buyerCountryIn: ["ES"],
      buyerRegionIn: ["canary", "ceuta", "melilla"],
      placeOfSupplyIn: ["ES.mainland", "ES.balearic"],
    },
    result: {
      treatment: "exempt_with_credit",
      ratePercent: 0,
      invoiceMention:
        "Operación exenta — exportación a territorio fuera del IVA (Canarias / Ceuta / Melilla, Art. 21 LIVA).",
    },
  },

  /* ------------------------------------------------------------------- */
  /* SUPER-REDUCED 4% — Art. 91.Dos (priority 200)                        */
  /* ------------------------------------------------------------------- */

  {
    id: "iva.rate.4.basic_food",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "2024-10-01",
    priority: 200,
    source: ["Ley 37/1992 Art. 91.Dos.1.1.º", "RDL 4/2024"],
    applies: {
      operationType: ["goods_supply"],
      requireHints: ["isBasicFood"],
      forbidHints: ["isAlcoholic"],
      placeOfSupplyIn: PENINSULA,
    },
    result: { ratePercent: 4, treatment: "taxable" },
    notes: "Bread, flour, milk, cheese, eggs, fruit, vegetables, legumes, tubers, cereals. Stepped from temporary 0% (2023) → 2% → 4% (Oct 2024).",
  },

  {
    id: "iva.rate.4.books_periodicals",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "1993-01-01",
    priority: 200,
    source: ["Ley 37/1992 Art. 91.Dos.1.2.º"],
    applies: {
      operationType: ["goods_supply", "services_supply"],
      requireHints: ["isBookOrPeriodical"],
      placeOfSupplyIn: PENINSULA,
    },
    result: { ratePercent: 4, treatment: "taxable" },
  },

  {
    id: "iva.rate.4.medicines_human",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "1993-01-01",
    priority: 200,
    source: ["Ley 37/1992 Art. 91.Dos.1.3.º"],
    applies: {
      operationType: ["goods_supply"],
      requireHints: ["isMedicineForHumanUse"],
      placeOfSupplyIn: PENINSULA,
    },
    result: { ratePercent: 4, treatment: "taxable" },
  },

  {
    id: "iva.rate.4.vehicles_disability",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "1993-01-01",
    priority: 200,
    source: ["Ley 37/1992 Art. 91.Dos.1.4.º"],
    applies: {
      operationType: ["goods_supply"],
      requireHints: ["isVehicleForDisability"],
      placeOfSupplyIn: PENINSULA,
    },
    result: { ratePercent: 4, treatment: "taxable" },
  },

  {
    id: "iva.rate.4.feminine_hygiene",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "2023-01-01",
    priority: 200,
    source: ["Ley 37/1992 Art. 91.Dos.1.1.5.º", "Ley 31/2022"],
    applies: {
      operationType: ["goods_supply"],
      requireHints: ["isFeminineHygieneProduct"],
      placeOfSupplyIn: PENINSULA,
    },
    result: { ratePercent: 4, treatment: "taxable" },
    notes: "Pads, tampons, panty liners, menstrual cups, condoms, contraceptives. Reduced from 10% to 4% in Jan 2023.",
  },

  {
    id: "iva.rate.4.social_housing_vpo",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "1993-01-01",
    priority: 200,
    source: ["Ley 37/1992 Art. 91.Dos.1.6.º"],
    applies: {
      operationType: ["goods_supply"],
      requireHints: ["isSocialHousingVPO"],
      placeOfSupplyIn: PENINSULA,
    },
    result: { ratePercent: 4, treatment: "taxable" },
  },

  {
    id: "iva.rate.4.disabled_assistance",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "1993-01-01",
    priority: 200,
    source: ["Ley 37/1992 Art. 91.Dos.2.3.º"],
    applies: {
      operationType: ["services_supply"],
      requireHints: ["isDisabledAssistanceService"],
      placeOfSupplyIn: PENINSULA,
    },
    result: { ratePercent: 4, treatment: "taxable" },
  },

  /* ------------------------------------------------------------------- */
  /* REDUCED 10% — Art. 91.Uno (priority 150)                              */
  /* ------------------------------------------------------------------- */

  {
    id: "iva.rate.10.hospitality",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "2012-09-01",
    priority: 150,
    source: ["Ley 37/1992 Art. 91.Uno.2.2.º"],
    applies: {
      operationType: ["services_supply"],
      requireHints: ["isHospitality"],
      placeOfSupplyIn: PENINSULA,
    },
    result: { ratePercent: 10, treatment: "taxable" },
    notes: "Restaurant, hotel, catering. Alcohol served alongside food still 10%.",
  },

  {
    id: "iva.rate.10.passenger_transport",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "1993-01-01",
    priority: 150,
    source: ["Ley 37/1992 Art. 91.Uno.2.1.º"],
    applies: {
      operationType: ["services_supply"],
      requireHints: ["isPassengerTransport"],
      placeOfSupplyIn: PENINSULA,
    },
    result: { ratePercent: 10, treatment: "taxable" },
  },

  {
    id: "iva.rate.10.cultural_events",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "2018-07-05",
    priority: 150,
    source: ["Ley 37/1992 Art. 91.Uno.2.6.º", "BOE-A-2018-9268"],
    applies: {
      operationType: ["services_supply"],
      requireHints: ["isCulturalEvent"],
      placeOfSupplyIn: PENINSULA,
    },
    result: { ratePercent: 10, treatment: "taxable" },
  },

  {
    id: "iva.rate.10.hairdressing",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "1993-01-01",
    priority: 150,
    source: ["Ley 37/1992 Art. 91.Uno.2.7.º"],
    applies: {
      operationType: ["services_supply"],
      requireHints: ["isHairdressing"],
      placeOfSupplyIn: PENINSULA,
    },
    result: { ratePercent: 10, treatment: "taxable" },
  },

  {
    id: "iva.rate.10.first_dwelling_transmission",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "2012-09-01",
    priority: 150,
    source: ["Ley 37/1992 Art. 91.Uno.1.7.º"],
    applies: {
      operationType: ["goods_supply"],
      requireHints: ["isFirstTransmissionDwelling"],
      placeOfSupplyIn: PENINSULA,
    },
    result: { ratePercent: 10, treatment: "taxable" },
  },

  {
    id: "iva.rate.10.water",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "1993-01-01",
    priority: 150,
    source: ["Ley 37/1992 Art. 91.Uno.1.4.º"],
    applies: {
      operationType: ["goods_supply"],
      requireHints: ["isWaterSupply"],
      placeOfSupplyIn: PENINSULA,
    },
    result: { ratePercent: 10, treatment: "taxable" },
  },

  {
    id: "iva.rate.10.veterinary_medicine",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "1993-01-01",
    priority: 150,
    source: ["Ley 37/1992 Art. 91.Uno.1.5.º"],
    applies: {
      operationType: ["goods_supply"],
      requireHints: ["isVeterinaryMedicine"],
      placeOfSupplyIn: PENINSULA,
    },
    result: { ratePercent: 10, treatment: "taxable" },
  },

  {
    id: "iva.rate.10.sanitary_products",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "1993-01-01",
    priority: 150,
    source: ["Ley 37/1992 Art. 91.Uno.1.6.º"],
    applies: {
      operationType: ["goods_supply"],
      requireHints: ["isSanitaryProduct"],
      placeOfSupplyIn: PENINSULA,
    },
    result: { ratePercent: 10, treatment: "taxable" },
  },

  {
    id: "iva.rate.10.flowers_plants",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "1993-01-01",
    priority: 150,
    source: ["Ley 37/1992 Art. 91.Uno.1.8.º"],
    applies: {
      operationType: ["goods_supply"],
      requireHints: ["isFlowerOrPlant"],
      placeOfSupplyIn: PENINSULA,
    },
    result: { ratePercent: 10, treatment: "taxable" },
  },

  {
    id: "iva.rate.10.agricultural_inputs",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "1993-01-01",
    priority: 150,
    source: ["Ley 37/1992 Art. 91.Uno.1.3.º"],
    applies: {
      operationType: ["goods_supply"],
      requireHints: ["isAgriculturalInput"],
      placeOfSupplyIn: PENINSULA,
    },
    result: { ratePercent: 10, treatment: "taxable" },
  },

  /* ------------------------------------------------------------------- */
  /* GENERAL 21% — Art. 90                                                */
  /* ------------------------------------------------------------------- */

  {
    id: "iva.rate.21.general",
    jurisdiction: "ES.mainland",
    taxCode: "IVA",
    effectiveFrom: "2012-09-01",
    priority: 10,
    source: ["Ley 37/1992 Art. 90", "BOE-A-2012-10403"],
    applies: {
      placeOfSupplyIn: ["ES.mainland", "ES.balearic"],
    },
    result: { ratePercent: 21, treatment: "taxable" },
    notes: "Catch-all general rate. Lowest priority — anything not matched elsewhere lands here.",
  },
];

/* --------------------------------------------------------------------- */
/* IGIC — Canary Islands (Ley 20/1991)                                    */
/* --------------------------------------------------------------------- */
export const IGIC_RULES: Rule[] = [
  /* Exports — goods sent from Canary Islands to Peninsula/Balearics or outside EU.
     Zero-rated with credit (the importer pays IVA on entry to mainland). */
  {
    id: "igic.zero.export_to_peninsula",
    jurisdiction: "ES.canary",
    taxCode: "IGIC",
    effectiveFrom: "1993-01-01",
    priority: 950,
    source: ["Ley 20/1991 Art. 11.1.1.º"],
    applies: {
      operationType: ["goods_supply"],
      buyerCountryIn: ["ES"],
      buyerRegionIn: ["mainland", "balearic", "ceuta", "melilla", "pais_vasco", "navarra"],
      placeOfSupplyIn: ["ES.canary"],
    },
    result: {
      treatment: "exempt_with_credit",
      ratePercent: 0,
      invoiceMention:
        "Operación exenta — envío fuera de Canarias (Art. 11.1.1.º Ley 20/1991). El IVA se devenga al entrar en territorio peninsular.",
    },
    notes: "Sale from Canarias to mainland Spain is an export from IGIC perspective. Buyer pays IVA at importation.",
  },
  {
    id: "igic.zero.export_outside_eu",
    jurisdiction: "ES.canary",
    taxCode: "IGIC",
    effectiveFrom: "1993-01-01",
    priority: 950,
    source: ["Ley 20/1991 Art. 11.1.2.º"],
    applies: {
      operationType: ["export"],
      placeOfSupplyIn: ["ES.canary"],
    },
    result: {
      treatment: "exempt_with_credit",
      ratePercent: 0,
      invoiceMention: "Operación exenta — exportación (Art. 11.1.2.º Ley 20/1991).",
    },
  },

  /* Exemptions (Art. 50) — parallel to IVA Art. 20 */
  {
    id: "igic.exempt.healthcare",
    jurisdiction: "ES.canary",
    taxCode: "IGIC",
    effectiveFrom: "1993-01-01",
    priority: 900,
    source: ["Ley 20/1991 Art. 50.Uno.6.º"],
    applies: {
      operationType: ["services_supply"],
      requireHints: ["isHealthcareService"],
      placeOfSupplyIn: ["ES.canary"],
    },
    result: {
      treatment: "exempt_without_credit",
      ratePercent: 0,
      invoiceMention: "Operación exenta de IGIC (Art. 50.Uno.6.º Ley 20/1991).",
    },
  },
  {
    id: "igic.exempt.education",
    jurisdiction: "ES.canary",
    taxCode: "IGIC",
    effectiveFrom: "1993-01-01",
    priority: 900,
    source: ["Ley 20/1991 Art. 50.Uno.9.º"],
    applies: {
      operationType: ["services_supply"],
      requireHints: ["isEducationService"],
      placeOfSupplyIn: ["ES.canary"],
    },
    result: {
      treatment: "exempt_without_credit",
      ratePercent: 0,
      invoiceMention: "Operación exenta de IGIC (Art. 50.Uno.9.º Ley 20/1991).",
    },
  },
  {
    id: "igic.exempt.financial",
    jurisdiction: "ES.canary",
    taxCode: "IGIC",
    effectiveFrom: "1993-01-01",
    priority: 900,
    source: ["Ley 20/1991 Art. 50.Uno.18.º"],
    applies: {
      operationType: ["services_supply"],
      requireHints: ["isFinancialService"],
      placeOfSupplyIn: ["ES.canary"],
    },
    result: {
      treatment: "exempt_without_credit",
      ratePercent: 0,
      invoiceMention: "Operación exenta de IGIC (Art. 50.Uno.18.º Ley 20/1991).",
    },
  },
  {
    id: "igic.exempt.insurance",
    jurisdiction: "ES.canary",
    taxCode: "IGIC",
    effectiveFrom: "1993-01-01",
    priority: 900,
    source: ["Ley 20/1991 Art. 50.Uno.16.º"],
    applies: {
      operationType: ["services_supply"],
      requireHints: ["isInsurance"],
      placeOfSupplyIn: ["ES.canary"],
    },
    result: {
      treatment: "exempt_without_credit",
      ratePercent: 0,
      invoiceMention: "Operación exenta de IGIC (Art. 50.Uno.16.º Ley 20/1991).",
    },
  },
  {
    id: "igic.exempt.residential_rental",
    jurisdiction: "ES.canary",
    taxCode: "IGIC",
    effectiveFrom: "1993-01-01",
    priority: 900,
    source: ["Ley 20/1991 Art. 50.Uno.23.º"],
    applies: {
      operationType: ["services_supply"],
      requireHints: ["isRentalDwelling"],
      placeOfSupplyIn: ["ES.canary"],
    },
    result: {
      treatment: "exempt_without_credit",
      ratePercent: 0,
      invoiceMention: "Arrendamiento de vivienda exento de IGIC (Art. 50.Uno.23.º Ley 20/1991).",
    },
  },

  /* Rate bands */
  {
    id: "igic.rate.0.basic",
    jurisdiction: "ES.canary",
    taxCode: "IGIC",
    effectiveFrom: "1993-01-01",
    priority: 200,
    source: ["Ley 20/1991 Art. 27.1.1"],
    applies: {
      operationType: ["goods_supply"],
      requireHints: ["isBasicFood"],
      placeOfSupplyIn: ["ES.canary"],
    },
    result: { ratePercent: 0, treatment: "taxable" },
  },
  {
    id: "igic.rate.0.books",
    jurisdiction: "ES.canary",
    taxCode: "IGIC",
    effectiveFrom: "1993-01-01",
    priority: 200,
    source: ["Ley 20/1991 Art. 27.1.1.b"],
    applies: {
      requireHints: ["isBookOrPeriodical"],
      placeOfSupplyIn: ["ES.canary"],
    },
    result: { ratePercent: 0, treatment: "taxable" },
  },
  {
    id: "igic.rate.0.medicines",
    jurisdiction: "ES.canary",
    taxCode: "IGIC",
    effectiveFrom: "1993-01-01",
    priority: 200,
    source: ["Ley 20/1991 Art. 27.1.1"],
    applies: {
      operationType: ["goods_supply"],
      requireHints: ["isMedicineForHumanUse"],
      placeOfSupplyIn: ["ES.canary"],
    },
    result: { ratePercent: 0, treatment: "taxable" },
  },
  {
    id: "igic.rate.3.passenger_transport",
    jurisdiction: "ES.canary",
    taxCode: "IGIC",
    effectiveFrom: "1993-01-01",
    priority: 150,
    source: ["Ley 20/1991 Art. 27.1.2"],
    applies: {
      operationType: ["services_supply"],
      requireHints: ["isPassengerTransport"],
      placeOfSupplyIn: ["ES.canary"],
    },
    result: { ratePercent: 3, treatment: "taxable" },
  },
  {
    id: "igic.rate.3.water",
    jurisdiction: "ES.canary",
    taxCode: "IGIC",
    effectiveFrom: "1993-01-01",
    priority: 150,
    source: ["Ley 20/1991 Art. 27.1.2"],
    applies: {
      requireHints: ["isWaterSupply"],
      placeOfSupplyIn: ["ES.canary"],
    },
    result: { ratePercent: 3, treatment: "taxable" },
  },
  {
    id: "igic.rate.7.hospitality",
    jurisdiction: "ES.canary",
    taxCode: "IGIC",
    effectiveFrom: "1993-01-01",
    priority: 150,
    source: ["Ley 20/1991 Art. 27"],
    applies: {
      operationType: ["services_supply"],
      requireHints: ["isHospitality"],
      placeOfSupplyIn: ["ES.canary"],
    },
    result: { ratePercent: 7, treatment: "taxable" },
  },
  {
    id: "igic.rate.20.tobacco",
    jurisdiction: "ES.canary",
    taxCode: "IGIC",
    effectiveFrom: "1993-01-01",
    priority: 250,
    source: ["Ley 20/1991 Art. 27.1.5"],
    applies: {
      requireHints: ["isTobacco"],
      placeOfSupplyIn: ["ES.canary"],
    },
    result: { ratePercent: 20, treatment: "taxable" },
  },
  {
    id: "igic.rate.7.general",
    jurisdiction: "ES.canary",
    taxCode: "IGIC",
    effectiveFrom: "2012-07-01",
    priority: 10,
    source: ["Ley 20/1991 Art. 27"],
    applies: { placeOfSupplyIn: ["ES.canary"] },
    result: { ratePercent: 7, treatment: "taxable" },
    notes: "General IGIC rate (7%). Catch-all.",
  },
];

/* --------------------------------------------------------------------- */
/* IPSI — Ceuta & Melilla (Ley 8/1991, plus city ordinances)              */
/* --------------------------------------------------------------------- */
export const IPSI_RULES: Rule[] = [
  {
    id: "ipsi.ceuta.general",
    jurisdiction: "ES.ceuta",
    taxCode: "IPSI",
    effectiveFrom: "1991-01-01",
    priority: 10,
    source: ["Ley 8/1991", "Ordenanza Fiscal IPSI Ceuta"],
    applies: { placeOfSupplyIn: ["ES.ceuta"] },
    result: { ratePercent: 4, treatment: "taxable" },
    notes:
      "Ceuta IPSI ordinance rates vary by activity (0.5%–10%). 4% used as MVP placeholder; refine with category mapping.",
  },
  {
    id: "ipsi.melilla.general",
    jurisdiction: "ES.melilla",
    taxCode: "IPSI",
    effectiveFrom: "1991-01-01",
    priority: 10,
    source: ["Ley 8/1991", "Ordenanza Fiscal IPSI Melilla"],
    applies: { placeOfSupplyIn: ["ES.melilla"] },
    result: { ratePercent: 4, treatment: "taxable" },
    notes:
      "Melilla IPSI ordinance rates vary by activity (0.5%–10%). 4% used as MVP placeholder; refine with category mapping.",
  },
];

/* --------------------------------------------------------------------- */
/* Equivalence surcharge bands (recargo de equivalencia)                  */
/* Applied as a parallel result on top of IVA when buyer is flagged.      */
/* Map matches the IVA rate to its surcharge band.                        */
/* --------------------------------------------------------------------- */
export function equivalenceSurchargeFor(ivaRate: number, isTobacco: boolean): number | undefined {
  if (isTobacco) return 1.75;
  if (ivaRate === 21) return 5.2;
  if (ivaRate === 10) return 1.4;
  if (ivaRate === 4) return 0.5;
  return undefined;
}

/* --------------------------------------------------------------------- */
/* Aggregate — full bootstrap rule set + version hash for audit log.      */
/* --------------------------------------------------------------------- */
export const ALL_RULES: Rule[] = [...IVA_RULES, ...IGIC_RULES, ...IPSI_RULES];

/** Bumped manually each time rules change. Recorded in every CalculationResult. */
export const RULES_VERSION = "2026-04-29.3";
