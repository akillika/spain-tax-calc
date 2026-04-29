import type {
  Jurisdiction,
  Line,
  PlaceOfSupply,
  Region,
  Transaction,
} from "./types";

/**
 * Determine place of supply per Art. 68–70 LIVA / Directive 2006/112/EC.
 *
 * Goods (Art. 68 LIVA):
 *   - General: where the goods are when transport begins.
 *   - Distance selling B2C: destination once €10k EU-wide threshold exceeded.
 *
 * Services (Art. 69–70 LIVA):
 *   - B2B general: where the customer is established.
 *   - B2C general: where the supplier is established.
 *   - Real-estate-related (Art. 70.Uno.1.º): location of the property.
 *   - Digital/telecom/broadcasting B2C (Art. 70.Uno.4.º/8.º): customer location.
 *   - Restaurant (Art. 70.Uno.5.º.b): where physically performed.
 *   - Passenger transport: where carried out (handled at line level — MVP simplifies).
 *   - Cultural/sporting events B2C: where event is held.
 *
 * Special territories:
 *   Sales from the peninsula/Balearics to Canary/Ceuta/Melilla are EXPORTS for IVA
 *   purposes. The engine flags this by setting jurisdiction to ES.canary/ceuta/melilla
 *   so the IVA rule "iva.zero.export_to_special_territories" applies.
 */
export function determinePlaceOfSupply(
  tx: Transaction,
  line: Line,
): PlaceOfSupply {
  const seller = tx.seller;
  const buyer = tx.buyer;
  const isService = tx.operationType === "services_supply";
  const buyerIsBusiness = buyer.type === "business";

  // Real-estate-related services → location of the property (Art. 70.Uno.1.º).
  if (isService && line.hints?.isRealEstateRelated) {
    const loc = line.hints.realEstateLocation;
    if (loc) {
      return {
        country: loc.country,
        region: loc.region,
        jurisdiction: jurisdictionFor(loc.country, loc.region),
        reason:
          "Service related to immovable property — place of supply is where the property is located (Art. 70.Uno.1.º LIVA).",
      };
    }
  }

  // Digital / telecom / broadcasting services to consumers → customer location (Art. 70.Uno.4.º/8.º).
  if (
    isService &&
    !buyerIsBusiness &&
    (line.hints?.isDigitalService || line.hints?.isTelecomBroadcast)
  ) {
    return {
      country: buyer.country,
      region: buyer.region,
      jurisdiction: jurisdictionFor(buyer.country, buyer.region),
      reason:
        "Digital / telecom / broadcasting service to a consumer — place of supply is the customer's location (Art. 70.Uno.4.º/8.º LIVA).",
    };
  }

  // Hospitality / cultural events to consumers — physically performed where service happens.
  if (
    isService &&
    (line.hints?.isHospitality || line.hints?.isCulturalEvent) &&
    !buyerIsBusiness
  ) {
    // MVP: assume performed at seller's location.
    return {
      country: seller.country,
      region: seller.region,
      jurisdiction: jurisdictionFor(seller.country, seller.region),
      reason:
        "Hospitality / cultural service to a consumer — place of supply is where the service is physically rendered (Art. 70.Uno.5.º.b LIVA).",
    };
  }

  // B2B services general rule → where the customer is established (Art. 69.Uno.1.º).
  if (isService && buyerIsBusiness) {
    return {
      country: buyer.country,
      region: buyer.region,
      jurisdiction: jurisdictionFor(buyer.country, buyer.region),
      reason:
        "B2B service — place of supply is where the customer is established (Art. 69.Uno.1.º LIVA, general rule).",
    };
  }

  // B2C services general rule → where the supplier is established (Art. 69.Uno.2.º).
  if (isService) {
    return {
      country: seller.country,
      region: seller.region,
      jurisdiction: jurisdictionFor(seller.country, seller.region),
      reason:
        "B2C service — place of supply is where the supplier is established (Art. 69.Uno.2.º LIVA, general rule).",
    };
  }

  // ---------------- GOODS ----------------

  // Export outside EU → place of supply remains origin (Spain), but treatment is exempt-with-credit.
  if (tx.operationType === "export") {
    return {
      country: seller.country,
      region: seller.region,
      jurisdiction: jurisdictionFor(seller.country, seller.region),
      reason:
        "Export of goods — origin Spain; rule chain emits exempt-with-credit treatment (Art. 21 LIVA).",
    };
  }

  // Goods sold within Spain — place of supply is where transport begins, i.e. seller's location.
  // Sales from peninsula/Balearics to Canary/Ceuta/Melilla remain "ES.mainland" / "ES.balearic"
  // for IVA purposes; the export-to-special-territories rule predicate detects buyer.region
  // and emits zero-rating under Art. 21 LIVA. The IGIC/IPSI side fires at importation (handled
  // by the importer, not the seller).
  if (buyer.country === "ES" && isSpecialTerritory(buyer.region) && !isSpecialTerritory(seller.region)) {
    return {
      country: "ES",
      region: seller.region,
      jurisdiction: jurisdictionFor("ES", seller.region),
      reason:
        "Goods shipped from peninsula/Balearics to a Spanish special territory (Canarias/Ceuta/Melilla). Place of supply is the seller's location — Art. 21 LIVA zero-rates the sale (importer pays IGIC/IPSI on entry).",
    };
  }

  // Intra-EU goods supply (B2B): origin Spain, but exempt under Art. 25.
  if (
    tx.operationType === "goods_supply" &&
    buyer.country !== "ES" &&
    buyerIsBusiness
  ) {
    return {
      country: seller.country,
      region: seller.region,
      jurisdiction: jurisdictionFor(seller.country, seller.region),
      reason:
        "Intra-community goods supply B2B — origin Spain, zero-rated under Art. 25 LIVA when VIES validated.",
    };
  }

  // Default goods: where transport begins → seller location.
  return {
    country: seller.country,
    region: seller.region,
    jurisdiction: jurisdictionFor(seller.country, seller.region),
    reason:
      "Goods supply — place of supply is where transport to the buyer begins, i.e. the seller's location (Art. 68.Uno LIVA).",
  };
}

export function jurisdictionFor(
  country: string,
  region?: Region,
): Jurisdiction {
  if (country !== "ES") return country in EU_COUNTRIES ? "EU" : "ROW";
  if (!region) return "ES.mainland";
  return `ES.${region}` as Jurisdiction;
}

export function isSpecialTerritory(region?: Region): boolean {
  return region === "canary" || region === "ceuta" || region === "melilla";
}

/** EU member states — used to distinguish intra-EU from rest-of-world. */
export const EU_COUNTRIES: Record<string, true> = {
  AT: true, BE: true, BG: true, HR: true, CY: true, CZ: true, DK: true,
  EE: true, FI: true, FR: true, DE: true, GR: true, HU: true, IE: true,
  IT: true, LV: true, LT: true, LU: true, MT: true, NL: true, PL: true,
  PT: true, RO: true, SK: true, SI: true, ES: true, SE: true,
};
