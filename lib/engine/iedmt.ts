import type { IedmtInfo, Line, Region } from "./types";

/**
 * IEDMT — Impuesto Especial sobre Determinados Medios de Transporte
 * (Ley 38/1992 Art. 65–74).
 *
 * Bands by CO2 emissions (g/km), modulated by region:
 *
 *   Mainland / Balearics:  <120 g → 0% · 120-159 → 4.75% · 160-199 → 9.75% · ≥200 → 14.75%
 *   Canary Islands:         coefficient ×0.85
 *   Ceuta & Melilla:        not subject to IEDMT (separate IPSI applies)
 *
 * The base is the vehicle's market value (we use line.quantity * line.unitPriceNet
 * as net price proxy).
 */

export interface IedmtResult {
  ratePercent: number;
  amount: number;
  band: string;
  source: string[];
}

export function computeIedmt(
  line: Line,
  region: Region | undefined,
): IedmtResult | undefined {
  const info: IedmtInfo | undefined = line.iedmt;
  if (!info) return undefined;
  if (info.technicalExemption) {
    return {
      ratePercent: 0,
      amount: 0,
      band: "Exempt (Art. 66 LIIEE — technical exemption)",
      source: ["Ley 38/1992 Art. 66"],
    };
  }

  if (region === "ceuta" || region === "melilla") return undefined;

  const co2 = info.co2gPerKm;
  let band: string;
  let baseRate: number;
  if (co2 < 120) {
    band = "<120 g/km";
    baseRate = 0;
  } else if (co2 < 160) {
    band = "120–159 g/km";
    baseRate = 4.75;
  } else if (co2 < 200) {
    band = "160–199 g/km";
    baseRate = 9.75;
  } else {
    band = "≥200 g/km";
    baseRate = 14.75;
  }

  const coefficient = region === "canary" ? 0.85 : 1;
  const ratePercent = round2(baseRate * coefficient);
  const taxableBase = line.quantity * line.unitPriceNet;
  const amount = round2((taxableBase * ratePercent) / 100);

  return {
    ratePercent,
    amount,
    band,
    source: ["Ley 38/1992 Art. 70"],
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
