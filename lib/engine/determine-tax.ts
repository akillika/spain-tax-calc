import type { PlaceOfSupply, TaxAuthority, TaxCode, Transaction } from "./types";

/**
 * Decide which Spanish indirect tax applies given the resolved place of supply.
 *
 * IVA — mainland + Balearics
 * IGIC — Canary Islands
 * IPSI — Ceuta / Melilla
 * NONE — operations outside Spain (engine still returns 0% for transparency)
 *
 * Foral routing: Basque provinces and Navarre apply IVA but the *competent
 * authority* differs based on volume / domicile rules (Concierto / Convenio
 * Económico). MVP routes by seller domicile; full pro-rata logic comes later.
 */
export function determineTaxCode(place: PlaceOfSupply): TaxCode {
  switch (place.jurisdiction) {
    case "ES.mainland":
    case "ES.balearic":
    case "ES.pais_vasco":
    case "ES.navarra":
      return "IVA";
    case "ES.canary":
      return "IGIC";
    case "ES.ceuta":
    case "ES.melilla":
      return "IPSI";
    default:
      return "NONE";
  }
}

/**
 * Determine which tax authority collects.
 *
 * MVP rule of thumb (Concierto Económico País Vasco / Convenio Navarra):
 *   - Operations with place of supply in Pais Vasco / Navarra → respective foral authority.
 *   - Otherwise → AEAT for IVA, ATC for IGIC, Ceuta/Melilla cities for IPSI.
 *
 * Full pro-rata routing for sellers with >€10M turnover operating across territories
 * is deferred to Phase 2 (it requires turnover data we don't collect yet).
 */
export function determineTaxAuthority(
  tx: Transaction,
  place: PlaceOfSupply,
): TaxAuthority {
  if (place.jurisdiction === "ES.canary") return "ATC";
  if (place.jurisdiction === "ES.ceuta") return "Ceuta";
  if (place.jurisdiction === "ES.melilla") return "Melilla";

  // Foral territories — route by seller's region as a first approximation.
  if (tx.seller.region === "navarra") return "Navarra";
  if (tx.seller.region === "pais_vasco") {
    // We don't currently capture province (Bizkaia/Gipuzkoa/Alava). Default to Bizkaia
    // and emit a warning at the calculation level.
    return "Bizkaia";
  }

  return "AEAT";
}
