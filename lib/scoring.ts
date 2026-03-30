import type { Supplier } from "./types";

interface SupplierMaterialScore {
  material_id: string;
  price: number;
}

export interface ScoringParams {
  supplier: Supplier & { supplier_materials: SupplierMaterialScore[] };
  siteCoords: { lat: number; lng: number };
  materialId: string;
  allPrices: number[];
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
  const { supplier, siteCoords, materialId, allPrices, allDistances } = params;
  const distance = calculateDistance(siteCoords, { lat: supplier.lat, lng: supplier.lng });
  const maxDistance = Math.max(...allDistances, 1);
  const distanceScore = 50 * (1 - distance / maxDistance);

  const supplierMaterial = supplier.supplier_materials.find(
    (material) => material.material_id === materialId
  );
  const price = supplierMaterial?.price ?? Infinity;
  const maxPrice = Math.max(...allPrices, 1);
  const priceScore = price === Infinity ? 0 : 30 * (1 - price / maxPrice);

  const stockScore =
    supplier.stock_availability === "permanent"
      ? 20
      : supplier.stock_availability === "partial"
        ? 12
        : 4;

  return Math.round(Math.max(0, distanceScore + priceScore + stockScore));
}
