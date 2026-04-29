# Spain Tax — Coverage matrix

Status legend: ✅ covered · 🟡 partial · ❌ not yet · ⚪ explicit out-of-scope.

Last reviewed: 2026-04-29. Rules version `2026-04-29.2`.

This document tracks every material Spanish indirect-tax topic and where the
engine stands today. Each row points to the rule IDs that implement it (or to
the open gap). New rules MUST be added with a citation and a fixture.

---

## 1. IVA — Ley 37/1992 (LIVA)

### 1.1 Scope (Art. 4–9)
| Topic | Status | Rule / module |
|---|---|---|
| Goods supply within Spain | ✅ | `lib/engine/place-of-supply.ts` |
| Services supply within Spain | ✅ | `lib/engine/place-of-supply.ts` |
| Intra-EU acquisition | 🟡 | place-of-supply OK, no acquisition-side rate rule |
| Importation | 🟡 | flagged at place-of-supply, customs-side IVA not computed |
| Self-supply (autoconsumo) | 🟡 | operationType supported, no specific rule |
| Free supply (entrega gratuita) | 🟡 | operationType supported, base = market value not applied |
| New means of transport | ❌ | Art. 25.Dos special rule missing |

### 1.2 Place of supply (Art. 68–70)
| Topic | Status | Rule |
|---|---|---|
| Goods — origin | ✅ | default branch |
| Goods — sales to special territories | ✅ | special-case branch + `iva.zero.export_to_special_territories` |
| Goods — distance selling B2C / OSS €10k threshold | ❌ | needs invoice-level state (cumulative EU sales) |
| Goods — chain transactions / triangulation | ❌ | predicate scaffolding exists in `Transaction.triangulation` |
| Services — B2B general (customer location) | ✅ | Art. 69.Uno.1.º branch |
| Services — B2C general (supplier location) | ✅ | Art. 69.Uno.2.º branch |
| Services — real-estate-related | ✅ | uses AI hint `isRealEstateRelated` + location |
| Services — digital/telecom/broadcasting B2C | ✅ | hint-driven |
| Services — restaurant / hospitality B2C | 🟡 | currently assumed seller-location |
| Services — passenger transport (per-leg) | ❌ | needs leg-by-leg country split |
| Services — short-term hire of means of transport | ❌ | |
| Services — cultural / sports events B2C | 🟡 | partial via hint |
| Call-off stock (Art. 9 bis) | ❌ | |

### 1.3 Exemptions — Art. 20.Uno
| Sub-art. | Topic | Status | Rule |
|---|---|---|---|
| 1.º | Postal services | ✅ | `iva.exempt.postal` |
| 2.º / 3.º | Healthcare | ✅ | `iva.exempt.healthcare` |
| 8.º | Social services / non-profits | ✅ | `iva.exempt.social_services` |
| 9.º | Education (regulated) | ✅ | `iva.exempt.education` |
| 12.º | Trade unions / political / religious / non-profit assoc. dues | ✅ | `iva.exempt.nonprofit_dues` |
| 13.º | Sports services by non-profits | ✅ | `iva.exempt.sports_nonprofit` |
| 14.º | Cultural services by public bodies / non-profits | ✅ | `iva.exempt.cultural_public` |
| 16.º | Insurance / reinsurance | ✅ | `iva.exempt.insurance` |
| 18.º | Financial services | ✅ | `iva.exempt.financial` |
| 19.º | Lotteries / betting | ✅ | `iva.exempt.lottery` |
| 20.º | Land transmissions | ✅ | `iva.exempt.land_sale` |
| 22.º | Second transmission of buildings | ✅ | `iva.exempt.second_building` (with Art. 20.Dos waiver detection) |
| 23.º | Residential rental | ✅ | `iva.exempt.residential_rental` |

### 1.4 Exemptions with credit (zero-rated) — Art. 21–25
| Topic | Status | Rule |
|---|---|---|
| Export of goods (Art. 21) | ✅ | `iva.zero.export_goods` |
| Sales to Canarias / Ceuta / Melilla (Art. 21.1.º) | ✅ | `iva.zero.export_to_special_territories` |
| Operations assimilated to export — vessels, aircraft (Art. 22) | ❌ | |
| Free zones / customs warehouses (Art. 23–24) | ❌ | |
| Intra-EU goods supply (Art. 25) | ✅ | `iva.zero.intra_eu_goods_b2b` |
| New means of transport intra-EU (Art. 25.Dos) | ❌ | |
| Triangulation simplification (Art. 26.Tres) | ❌ | |

### 1.5 Reverse charge — Art. 84.Uno.2.º
| Sub-art. | Topic | Status | Rule |
|---|---|---|---|
| a | Supplier non-resident in TAI | 🟡 | only applies when our seller is non-resident; out of our user's perspective |
| b | Investment gold | ✅ | `iva.rc.investment_gold` |
| b (modified) | Gold/precious metals | ✅ | `iva.rc.precious_metals` |
| c | Scrap and recovered materials | ✅ | `iva.rc.scrap` |
| d | Greenhouse gas emission rights | ✅ | `iva.rc.emission_rights` |
| e | Real estate w/ Art. 20.Dos waiver, exec of mortgage, dación en pago | ✅ | `iva.rc.real_estate_with_waiver` |
| f | Construction services B2B | ✅ | `iva.rc.construction_b2b` |
| g | Electronic devices > €10k B2B | ✅ | `iva.rc.electronics_over_10k` |
| h | Gas / electricity / heating / cooling certificates from non-resident | ✅ | `iva.rc.energy_certificates` |

### 1.6 Tax base & modifications — Art. 78–80
| Topic | Status | Notes |
|---|---|---|
| Taxable base = consideration | ✅ | `compute.ts` |
| Discounts on invoice | ✅ | `applyDiscount()` (commercial only) |
| Financial / post-invoice discounts | ❌ | |
| Bad debt recovery (Art. 80.Cuatro/Cinco) | ❌ | |
| Free supply — base = market value | ❌ | |
| Foreign currency — exchange at devengo | 🟡 | currency carried but no FX |

### 1.7 Rates — Art. 90 (general 21%) + Art. 91 (reduced/super-reduced)
| Sub-art. | Category | Rate | Status | Rule |
|---|---|---|---|---|
| 91.Uno.1.1.º | Food (non-basic) | 10% | ✅ | falls through to 10% via category-prefix |
| 91.Uno.1.3.º | Agricultural inputs (seeds, fertilizers, pesticides) | 10% | ✅ | `iva.rate.10.agricultural_inputs` |
| 91.Uno.1.4.º | Water | 10% | ✅ | `iva.rate.10.water` |
| 91.Uno.1.5.º | Veterinary medicines | 10% | ✅ | `iva.rate.10.veterinary_medicine` |
| 91.Uno.1.6.º | Sanitary products / disability aids | 10% | ✅ | `iva.rate.10.sanitary_products` |
| 91.Uno.1.7.º | First-transmission dwelling | 10% | ✅ | `iva.rate.10.first_dwelling_transmission` |
| 91.Uno.1.8.º | Flowers and ornamental plants | 10% | ✅ | `iva.rate.10.flowers_plants` |
| 91.Uno.2.1.º | Passenger transport | 10% | ✅ | `iva.rate.10.passenger_transport` |
| 91.Uno.2.2.º | Hospitality (restaurant, hotel, catering) | 10% | ✅ | `iva.rate.10.hospitality` |
| 91.Uno.2.6.º | Cultural events | 10% | ✅ | `iva.rate.10.cultural_events` |
| 91.Uno.2.7.º | Hairdressing | 10% | ✅ | `iva.rate.10.hairdressing` |
| 91.Dos.1.1.º | Basic food | 4% | ✅ | `iva.rate.4.basic_food` |
| 91.Dos.1.2.º | Books / newspapers / magazines | 4% | ✅ | `iva.rate.4.books_periodicals` |
| 91.Dos.1.3.º | Medicines for human use | 4% | ✅ | `iva.rate.4.medicines_human` |
| 91.Dos.1.4.º | Vehicles for disability | 4% | ✅ | `iva.rate.4.vehicles_disability` |
| 91.Dos.1.5.º | Feminine hygiene / contraceptives (since 2023) | 4% | ✅ | `iva.rate.4.feminine_hygiene` |
| 91.Dos.1.6.º | Social housing under VPO | 4% | ✅ | `iva.rate.4.social_housing_vpo` |
| 91.Dos.2.3.º | Assistance services to disabled | 4% | ✅ | `iva.rate.4.disabled_assistance` |

### 1.8 Equivalence surcharge (Art. 154–162)
| Topic | Status | |
|---|---|---|
| 21% IVA → 5.2% surcharge | ✅ | `equivalenceSurchargeFor()` |
| 10% → 1.4% | ✅ | |
| 4% → 0.5% | ✅ | |
| Tobacco → 1.75% | ✅ | |
| Surcharge on intra-EU acquisitions | ❌ | |

### 1.9 Special regimes
| Regime | Status | Notes |
|---|---|---|
| Régimen general | ✅ | default |
| Recargo de equivalencia | ✅ | applied as parallel result |
| REBU (used goods margin) | ❌ | margin-base calculation differs |
| REAGP (agriculture compensation) | ❌ | 12% / 10.5% compensation |
| Travel agencies | ❌ | margin scheme |
| Régimen simplificado (módulos) | ❌ | |
| REGE (group of entities) | ❌ | requires consolidation |
| Cash-basis (criterio de caja) | ❌ | timing differs (paid → devengo) |
| Investment gold | ✅ | exemption + reverse charge |

### 1.10 Invoicing (RD 1619/2012)
| Topic | Status | |
|---|---|---|
| Mandatory invoice mentions | ✅ | rule-emitted |
| Simplified invoice ≤ €400 | ✅ | warning at compute level |
| Rectifying invoices | ❌ | |
| Recapitulative invoices | ❌ | |
| Self-billing (factura del destinatario) | ❌ | |
| Verifactu signing (RD 1007/2023) | ⚪ | Phase 3 |

### 1.11 SII (Suministro Inmediato de Información, RD 596/2016)
| Topic | Status | |
|---|---|---|
| Detect SII obligation | 🟡 | flag carried, not validated |
| 4-day reporting deadline warning | ❌ | |

---

## 2. IGIC — Ley 20/1991 (Canary Islands)

| Topic | Status | Rule |
|---|---|---|
| 0% basic food | ✅ | `igic.rate.0.basic` |
| 3% reduced (passenger transport, water, etc.) | 🟡 | passenger transport only |
| 7% general | ✅ | catch-all |
| 9.5% increased | ❌ | |
| 15% special | ❌ | |
| 20% luxury (tobacco) | ✅ | `igic.rate.20.luxury` |
| Healthcare exemption | ✅ | `igic.exempt.healthcare` |
| Education exemption | ✅ | `igic.exempt.education` |
| Financial / insurance exemption | ✅ | `igic.exempt.financial`, `igic.exempt.insurance` |
| Reverse charges (IGIC equivalents) | ❌ | |
| IGIC equivalence surcharge | ❌ | |

---

## 3. IPSI — Ley 8/1991 (Ceuta & Melilla)

| Topic | Status | Notes |
|---|---|---|
| Ceuta — base 4% placeholder | 🟡 | needs per-category ordinance lookup |
| Melilla — base 4% placeholder | 🟡 | needs per-category ordinance lookup |
| Production-side IPSI | ❌ | |
| Importation-side IPSI | ❌ | |

---

## 4. Foral regimes

| Regime | Status | Notes |
|---|---|---|
| País Vasco IVA — substantively same as state | ✅ | |
| País Vasco — Bizkaia/Gipuzkoa/Álava authority routing | 🟡 | defaults to Bizkaia |
| Navarra IVA — substantively same | ✅ | |
| Volume pro-rata routing >€10M | ❌ | needs turnover input |
| TicketBAI (País Vasco) | ⚪ | Phase 3 |

---

## 5. IIEE — Ley 38/1992 (excise duties)

| Tax | Status | Module |
|---|---|---|
| Alcohol (beer, wine, intermediate, ethanol) | ✅ | `lib/engine/excise.ts` |
| Manufactured tobacco | ✅ | `lib/engine/excise.ts` |
| Hydrocarbons (state component) | ✅ | `lib/engine/excise.ts` |
| Hydrocarbons (autonomic component) | 🟡 | base zero — varies by CCAA |
| Electricity (5.11%) | ✅ | `lib/engine/excise.ts` |
| Coal | 🟡 | rate scaffolded, applies to specific buyers |
| IIEE included in IVA base | ✅ | added to taxable base in `compute.ts` |

---

## 6. IEDMT — Vehicle registration tax

| Topic | Status | |
|---|---|---|
| CO2 bands (0% / 4.75% / 9.75% / 14.75%) | ✅ | `lib/engine/iedmt.ts` |
| Canary / Ceuta / Melilla coefficient | ✅ | `lib/engine/iedmt.ts` |
| Technical exemptions (taxis, disability adapted, etc.) | ✅ | hint-driven |

---

## 7. Adjacent — declared scope

| Tax | Status | Notes |
|---|---|---|
| ITP (transmissions) | ⚪ | route + warn only, no compute (CCAA rates) |
| AJD (stamp duty) | ⚪ | route + warn only |
| IPS (insurance premiums 8%) | 🟡 | flagged via insurance exemption mention |
| Direct taxes (IRPF, IS, IRNR) | ⚪ | out of scope |

---

## 8. AI classifier coverage

The AI classifier emits structured hints from free-text descriptions. Each
hint's presence / absence drives `requireHints` / `forbidHints` predicates
on rules.

Hints available now:
- `isAlcoholic`, `isTobacco`, `isMedicineForHumanUse`, `isVeterinaryMedicine`,
  `isBookOrPeriodical`, `isBasicFood`, `isHospitality`, `isPassengerTransport`,
  `isCulturalEvent`, `isHealthcareService`, `isEducationService`,
  `isFinancialService`, `isInsurance`, `isRealEstateRelated`,
  `isRentalDwelling`, `isRentalCommercial`, `isFirstTransmissionDwelling`,
  `isSecondTransmissionBuilding`, `isLandSale`, `isDigitalService`,
  `isTelecomBroadcast`, `isConstructionServiceB2B`, `isScrap`,
  `isElectronicDeviceOver10k`, `isVehicleRegistration`, `isUsedGoods`,
  `isAgricultureProduct`, `isAgriculturalInput`, `isPostalService`,
  `isLotteryOrBetting`, `isSocialServiceNonProfit`, `isSportsServiceNonProfit`,
  `isCulturalServicePublic`, `isWaterSupply`, `isFlowerOrPlant`,
  `isSanitaryProduct`, `isVehicleForDisability`, `isSocialHousingVPO`,
  `isFeminineHygieneProduct`, `isDisabledAssistanceService`, `isInvestmentGold`,
  `isPreciousMetal`, `isEmissionRight`, `isEnergyCertificate`,
  `isHairdressing`, `isNonProfitMembership`, `isVATWaiverApplied`.

---

## 9. Out-of-scope (explicit)

- Verifactu signing & SII real-time submission — Phase 3.
- Multi-language UI — Phase 2.
- Historical invoice import — Phase 2.
- Tax planning / advice — never (legal liability).
- ITP/AJD computation (CCAA-specific).
