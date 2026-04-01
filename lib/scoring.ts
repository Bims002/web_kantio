import type { Supplier } from "./types";

interface SupplierMaterialScore {
  material_id: string;
}

export interface ScoringParams {
  supplier: Supplier & { supplier_materials: SupplierMaterialScore[] };
  siteCoords: { lat: number; lng: number };
  allDistances: number[];
}

export function calculateDistance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const earthRadiusKm = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const haversine =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  return earthRadiusKm * 2 * Math.asin(Math.sqrt(haversine));
}

export function scoreSupplier(params: ScoringParams): number {
  const { supplier, siteCoords } = params;
  const distance = calculateDistance(siteCoords, { lat: supplier.lat, lng: supplier.lng });
  // Distance est le critere principal: 90 points max
  // Un fournisseur a 0km = 90pts, 5km = 33pts, 10km = 12pts
  const distanceScore = 90 * Math.exp(-distance / 5);

  // Stock: 10 points max
  const stockScore =
    supplier.stock_availability === "permanent"
      ? 10
      : supplier.stock_availability === "partial"
        ? 6
        : 2;

  return Math.round(Math.max(0, distanceScore + stockScore));
}
