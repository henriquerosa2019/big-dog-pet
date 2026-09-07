/**
 * Motor de Cálculo de Distância e Custo Estimado de Combustível
 * Big Dog Pet - Franco da Rocha - SP
 * 
 * Calcula a distância do petshop ao endereço/CEP do tutor.
 * Regra Obrigatória: Se o tipo logístico for "buscar_e_devolver" (ida e volta),
 * a distância calculada deve ser exatamente o DOBRO (ida + volta).
 */

import { formatBRL } from "./format";
import type { LogisticsType } from "./transport";

/** Localização física da loja Big Dog Pet */
export const SHOP_LOCATION = {
  name: "Big Dog Pet",
  address: "Rua Rangel Pestana, 56",
  district: "Vila Bazú",
  city: "Franco da Rocha",
  state: "SP",
  cep: "07801-000",
  lat: -23.32185,
  lng: -46.7262,
};

/**
 * Mapeamento viário aproximado de distâncias (só ida, em km)
 * a partir do Petshop na Vila Bazú para os bairros de Franco da Rocha.
 */
export const FRANCO_DISTRICT_ONE_WAY_KM: Record<string, number> = {
  "vila bazu": 0.8,
  "vila bazú": 0.8,
  "centro": 1.2,
  "vila ramos": 1.8,
  "vila irma": 1.9,
  "cia fazenda belem": 2.1,
  "companhia fazenda belem": 2.1,
  "companhia fazenda belém": 2.1,
  "vila rosalina": 2.3,
  "vila josefina": 2.4,
  "jardim dos reis": 2.6,
  "jardim cruzeiro": 2.7,
  "vila lanfranchi": 2.8,
  "jardim alice": 2.9,
  "paradinha": 3.1,
  "parque vitoria": 3.4,
  "parque vitória": 3.4,
  "vila bela": 3.5,
  "jardim luciana": 3.6,
  "jardim progresso": 3.8,
  "pouso alegre": 4.2,
  "monte verde": 4.6,
  "polo industrial": 4.8,
  "sitio borda da mata": 5.2,
  "sítio borda da mata": 5.2,
  "lago azul": 5.5,
  "parque montreal": 6.2,
  "vila carvalho": 2.2,
  "chacara sao jose": 4.5,
  "chácara são josé": 4.5,
  "jardim cruzeiro do sul": 2.8,
};

/** Padrões operacionais de combustível */
export const DEFAULT_CONSUMPTION_KM_PER_LITER = 8.5; // Consumo urbano de utilitário/van
export const DEFAULT_FUEL_PRICE_CENTS = 589;         // R$ 5,89/litro de gasolina comum

export interface DistanceCalculationResult {
  oneWayKm: number;
  distanceKm: number;
  isRoundTrip: boolean;
  logisticsType: LogisticsType;
  consumptionKmPerLiter: number;
  fuelPriceCents: number;
  fuelCostEstimateCents: number;
  formattedDistance: string;
  formattedFuelCost: string;
  calculationMethod: "coordinates" | "district" | "cep" | "fallback";
}

/**
 * Calcula distância geodésica em linha reta via Haversine
 * e aplica fator de correção urbana de 1.25x para refletir a rota viária real.
 */
function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Raio da Terra em km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightLine = R * c;
  // Fator de enrolamento viário em vias urbanas (médio 1.25)
  return straightLine * 1.25;
}

/**
 * Normaliza strings para busca em dicionário
 */
function normalizeText(text?: string | null): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Estima a distância só de ida (em km) a partir dos dados do endereço e CEP.
 */
export function estimateOneWayDistanceKm(address?: {
  district?: string | null;
  street?: string | null;
  cep?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
}): { oneWayKm: number; method: "coordinates" | "district" | "cep" | "fallback" } {
  if (!address) {
    return { oneWayKm: 3.0, method: "fallback" };
  }

  // 1. Se tiver coordenadas precisas
  if (
    typeof address.lat === "number" &&
    typeof address.lng === "number" &&
    !isNaN(address.lat) &&
    !isNaN(address.lng)
  ) {
    const rawKm = haversineDistanceKm(
      SHOP_LOCATION.lat,
      SHOP_LOCATION.lng,
      address.lat,
      address.lng
    );
    return {
      oneWayKm: Math.max(0.6, Number(rawKm.toFixed(1))),
      method: "coordinates",
    };
  }

  // 2. Busca pelo Bairro em Franco da Rocha
  const normalizedDistrict = normalizeText(address.district);
  if (normalizedDistrict) {
    for (const [key, km] of Object.entries(FRANCO_DISTRICT_ONE_WAY_KM)) {
      const normKey = normalizeText(key);
      if (normalizedDistrict.includes(normKey) || normKey.includes(normalizedDistrict)) {
        return { oneWayKm: km, method: "district" };
      }
    }
  }

  // 3. Estimativa aproximada por CEP de Franco da Rocha (07800-000 a 07899-999)
  const cleanCep = (address.cep || "").replace(/\D/g, "");
  if (cleanCep.length === 8 && cleanCep.startsWith("078")) {
    const prefixNum = parseInt(cleanCep.substring(3, 5), 10);
    // Bairros próximos do centro têm numeração menor
    if (prefixNum <= 10) return { oneWayKm: 1.5, method: "cep" };
    if (prefixNum <= 30) return { oneWayKm: 2.8, method: "cep" };
    if (prefixNum <= 60) return { oneWayKm: 4.2, method: "cep" };
    return { oneWayKm: 5.5, method: "cep" };
  }

  // 4. Fallback padrão para a região urbana de Franco da Rocha
  return { oneWayKm: 3.2, method: "fallback" };
}

/**
 * Calcula a distância final e o custo estimado de combustível.
 * 
 * Regra Crítica:
 * Se `logisticsType === "buscar_e_devolver"` (ida e volta), a distância total é o DOBRO (oneWayKm * 2).
 * Se `logisticsType === "buscar"` ou `"devolver"`, a distância é 1 trecho (oneWayKm).
 * Se `logisticsType === "levar"`, o petshop não realiza transporte (distância 0).
 */
export function calculateTripDistanceAndFuel(
  address?: {
    district?: string | null;
    street?: string | null;
    cep?: string | null;
    city?: string | null;
    lat?: number | null;
    lng?: number | null;
  } | null,
  logisticsType: LogisticsType = "buscar_e_devolver",
  customFuelPriceCents: number = DEFAULT_FUEL_PRICE_CENTS,
  customConsumptionKmPerLiter: number = DEFAULT_CONSUMPTION_KM_PER_LITER
): DistanceCalculationResult {
  if (logisticsType === "levar" || !address) {
    return {
      oneWayKm: 0,
      distanceKm: 0,
      isRoundTrip: false,
      logisticsType,
      consumptionKmPerLiter: customConsumptionKmPerLiter,
      fuelPriceCents: customFuelPriceCents,
      fuelCostEstimateCents: 0,
      formattedDistance: "0.0 km",
      formattedFuelCost: formatBRL(0),
      calculationMethod: "fallback",
    };
  }

  const { oneWayKm, method } = estimateOneWayDistanceKm(address);
  const isRoundTrip = logisticsType === "buscar_e_devolver";

  // Se ida e volta -> DOBRO exato
  const distanceKm = Number((isRoundTrip ? oneWayKm * 2 : oneWayKm).toFixed(1));

  // Consumo: Litros = Distância / Consumo (km/l)
  // Custo = Litros * Preço (centavos/l)
  const fuelLiters = distanceKm / customConsumptionKmPerLiter;
  const fuelCostEstimateCents = Math.round(fuelLiters * customFuelPriceCents);

  return {
    oneWayKm,
    distanceKm,
    isRoundTrip,
    logisticsType,
    consumptionKmPerLiter: customConsumptionKmPerLiter,
    fuelPriceCents: customFuelPriceCents,
    fuelCostEstimateCents,
    formattedDistance: `${distanceKm.toFixed(1)} km`,
    formattedFuelCost: formatBRL(fuelCostEstimateCents),
    calculationMethod: method,
  };
}
