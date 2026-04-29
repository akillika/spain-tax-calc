import type { ExciseInfo, Line } from "./types";

/**
 * IIEE — Impuestos Especiales (Ley 38/1992).
 *
 * Rates are dated; this module returns the rate in force on a given date.
 * The excise amount is computed and ALSO added to the IVA taxable base
 * (Art. 78.Dos.4.º LIVA), so the chain is: net + excise = IVA base → IVA.
 *
 * Rates here are simplified for MVP. A production rule set would split by
 * sub-product (e.g. cigarettes vs. cigars vs. RYO tobacco; petrol vs.
 * diesel A vs. diesel B; sparkling vs. still wine).
 */

export interface ExciseResult {
  category: ExciseInfo["category"];
  amount: number;
  rateDescription: string;
  source: string[];
}

/**
 * Compute IIEE for a given line. Returns 0 when no excise applies.
 *
 * @param line  the invoice line
 * @param date  ISO date — drives rate selection
 */
export function computeExcise(line: Line, date: string): ExciseResult | undefined {
  if (!line.excise) return undefined;
  const { category, quantityForExcise } = line.excise;
  const qty = quantityForExcise ?? line.quantity;
  const net = line.quantity * line.unitPriceNet;

  switch (category) {
    case "alcohol": {
      // Simplified: ad-valorem proxy. Real ethanol tax is per litre of pure alcohol.
      // €11.50 / L of pure alcohol; here we approximate with 20% ad-valorem until
      // the user supplies pure-alcohol litres.
      return {
        category,
        amount: round2(net * 0.2),
        rateDescription: "Approx. 20% (ethanol; refine with quantityForExcise = litres of pure alcohol)",
        source: ["Ley 38/1992 Art. 39"],
      };
    }
    case "tobacco": {
      // Cigarettes: 51% ad-valorem + €27.36 / 1000 cigarettes specific.
      // We model only the ad-valorem half here.
      return {
        category,
        amount: round2(net * 0.51),
        rateDescription: "51% ad-valorem (cigarettes simplified)",
        source: ["Ley 38/1992 Art. 60"],
      };
    }
    case "hydrocarbons": {
      // Petrol (gasolina sin plomo 95): €40.07 / 100 L state component.
      // Modelled as €0.4 per litre on quantityForExcise. Caller passes litres.
      const perLitre = 0.4;
      return {
        category,
        amount: round2(qty * perLitre),
        rateDescription: "€0.40 / litre (gasoline state component, simplified)",
        source: ["Ley 38/1992 Art. 50"],
      };
    }
    case "electricity": {
      // 5.11269632% on net invoice value.
      const rate = electricityRateOn(date);
      return {
        category,
        amount: round2(net * rate),
        rateDescription: `${(rate * 100).toFixed(4)}% on supply value`,
        source: ["Ley 38/1992 Art. 92–99"],
      };
    }
    case "coal": {
      // €0.65 / GJ. Caller passes GJ in quantityForExcise.
      return {
        category,
        amount: round2(qty * 0.65),
        rateDescription: "€0.65 / GJ (final consumption)",
        source: ["Ley 38/1992 Art. 75 ter"],
      };
    }
  }
}

function electricityRateOn(date: string): number {
  // Temporary reductions during 2022–2023 energy crisis. Simplified model.
  if (date >= "2024-01-01") return 0.0511269632;
  if (date >= "2023-01-01") return 0.005;
  if (date >= "2021-09-16") return 0.005;
  return 0.0511269632;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
