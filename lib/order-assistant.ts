import { calculateDistance, scoreSupplier } from "./scoring";
import type { Supplier } from "./types";

export interface DraftSupplierMaterial {
  id: string;
  material_id: string;
  price: number;
  unit: string;
  material?: {
    name: string;
  };
}

export interface DraftSupplier {
  id: string;
  name: string;
  phone: string;
  city: string;
  delivery_delay_hours: number;
  supplier_materials: DraftSupplierMaterial[];
}

export interface DraftCartItem {
  materialId: string;
  quantity: number;
}

export interface OrderDraft {
  selectedSupplier: DraftSupplier;
  cart: DraftCartItem[];
  siteInfo: {
    name: string;
    address: string;
    city: string;
  };
  contactInfo: {
    name: string;
    phone: string;
    notes: string;
  };
  totalAmount: number;
  createdAt: string;
}

export interface RecommendationMaterial {
  id: string;
  name: string;
  category?: string;
  unit?: string;
}

export interface RecommendationSupplier extends Supplier {
  supplier_materials: DraftSupplierMaterial[];
}

export interface RecommendationContext {
  city: string;
  materials: RecommendationMaterial[];
  suppliers: RecommendationSupplier[];
}

export interface MaterialMatch {
  material: RecommendationMaterial;
  score: number;
}

export type RequiredDraftField =
  | "siteAddress"
  | "contactName"
  | "contactPhone";

interface DraftFieldValidationResult {
  isValid: boolean;
  normalizedValue: string;
  error?: string;
}

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  douala: { lat: 4.05, lng: 9.7 },
  yaounde: { lat: 3.86, lng: 11.5 },
};

const REQUIRED_FIELD_CONFIG: Record<
  RequiredDraftField,
  {
    label: string;
    prompt: string;
  }
> = {
  siteAddress: {
    label: "quartier de livraison",
    prompt:
      "Pour organiser la livraison, j ai besoin du quartier de livraison. Dans quel quartier faut-il livrer ?",
  },
  contactName: {
    label: "nom du contact",
    prompt:
      "Parfait. Quel est le nom de la personne a contacter pour la reception de la commande ?",
  },
  contactPhone: {
    label: "numero du contact",
    prompt:
      "Derniere information indispensable: quel numero de telephone devons-nous utiliser pour joindre ce contact ?",
  },
};

export function normalizeAssistantText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshteinDistance(left: string, right: string) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const matrix = Array.from({ length: left.length + 1 }, () =>
    Array.from<number>({ length: right.length + 1 })
  );

  for (let i = 0; i <= left.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= right.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[left.length][right.length];
}

function scoreMaterialMatch(query: string, material: RecommendationMaterial) {
  const normalizedQuery = normalizeAssistantText(query);
  const normalizedName = normalizeAssistantText(material.name);

  if (!normalizedQuery || !normalizedName) {
    return 0;
  }

  const queryWords = normalizedQuery.split(" ").filter((word) => word.length >= 3);
  const materialWords = normalizedName.split(" ");
  let score = 0;

  if (normalizedQuery.includes(normalizedName)) {
    score += 120;
  } else if (normalizedName.includes(normalizedQuery) && normalizedQuery.length >= 4) {
    score += 75;
  }

  for (const queryWord of queryWords) {
    if (normalizedName.includes(queryWord)) {
      score += 28;
    }

    for (const materialWord of materialWords) {
      if (queryWord === materialWord) {
        score += 36;
        continue;
      }

      if (materialWord.startsWith(queryWord) || queryWord.startsWith(materialWord)) {
        score += 22;
        continue;
      }

      const distance = levenshteinDistance(queryWord, materialWord);

      if (distance === 1) {
        score += 20;
      } else if (distance === 2 && Math.min(queryWord.length, materialWord.length) >= 5) {
        score += 12;
      }
    }
  }

  return score;
}

export function createOrderDraft(input: {
  selectedSupplier: DraftSupplier;
  cart: DraftCartItem[];
  siteInfo?: Partial<OrderDraft["siteInfo"]>;
  contactInfo?: Partial<OrderDraft["contactInfo"]>;
  totalAmount?: number;
}): OrderDraft {
  const totalAmount =
    input.totalAmount ??
    input.cart.reduce((sum, item) => {
      const material = input.selectedSupplier.supplier_materials.find(
        (entry) => entry.material_id === item.materialId
      );

      return sum + (material?.price || 0) * item.quantity;
    }, 0);

  return {
    selectedSupplier: {
      ...input.selectedSupplier,
      // Keep supplier direct contact out of the client-side draft.
      phone: "",
    },
    cart: input.cart,
    siteInfo: {
      name: input.siteInfo?.name || "",
      address: input.siteInfo?.address || "",
      city: input.siteInfo?.city || input.selectedSupplier.city,
    },
    contactInfo: {
      name: input.contactInfo?.name || "",
      phone: input.contactInfo?.phone || "",
      notes: input.contactInfo?.notes || "",
    },
    totalAmount,
    createdAt: new Date().toISOString(),
  };
}

export function getDraftMaterial(
  draft: OrderDraft,
  materialId: string
): DraftSupplierMaterial | undefined {
  return draft.selectedSupplier.supplier_materials.find(
    (material) => material.material_id === materialId
  );
}

export function getDraftLines(draft: OrderDraft) {
  return draft.cart.map((item) => {
    const material = getDraftMaterial(draft, item.materialId);

    return {
      ...item,
      material,
      lineTotal: (material?.price || 0) * item.quantity,
    };
  });
}

export function getMissingDraftFields(draft: OrderDraft | null): RequiredDraftField[] {
  if (!draft) {
    return ["siteAddress", "contactName", "contactPhone"];
  }

  const missing: RequiredDraftField[] = [];

  if (!draft.siteInfo.address.trim()) missing.push("siteAddress");
  if (!draft.contactInfo.name.trim()) missing.push("contactName");
  if (!draft.contactInfo.phone.trim()) missing.push("contactPhone");

  return missing;
}

export function getNextDraftField(draft: OrderDraft | null): RequiredDraftField | null {
  return getMissingDraftFields(draft)[0] || null;
}

export function getRequiredFieldLabel(field: RequiredDraftField): string {
  return REQUIRED_FIELD_CONFIG[field].label;
}

export function getNextDraftQuestion(draft: OrderDraft | null): string | null {
  const nextField = getNextDraftField(draft);

  return nextField ? REQUIRED_FIELD_CONFIG[nextField].prompt : null;
}

function normalizePhoneDigits(rawValue: string) {
  const digitsOnly = rawValue.replace(/\D/g, "");

  if (digitsOnly.startsWith("00237")) {
    return digitsOnly.slice(5);
  }

  if (digitsOnly.startsWith("237")) {
    return digitsOnly.slice(3);
  }

  return digitsOnly;
}

export function validateDraftFieldAnswer(
  field: RequiredDraftField,
  rawValue: string
): DraftFieldValidationResult {
  const normalizedValue = rawValue.trim().replace(/\s+/g, " ");

  switch (field) {
    case "siteAddress":
      if (normalizedValue.length < 3 || !/[A-Za-zÀ-ÿ]/.test(normalizedValue)) {
        return {
          isValid: false,
          normalizedValue,
          error:
            "Le quartier semble incomplet. Donnez juste un quartier clair, par exemple Akwa, Makepe ou Bastos.",
        };
      }
      return { isValid: true, normalizedValue };
    case "contactName":
      if (normalizedValue.length < 4 || !/[A-Za-zÀ-ÿ]/.test(normalizedValue)) {
        return {
          isValid: false,
          normalizedValue,
          error:
            "Le nom du contact ne semble pas correct. Veuillez donnez au moins un nom identifiable pour la reception.",
        };
      }
      return { isValid: true, normalizedValue };
    case "contactPhone": {
      const phoneDigits = normalizePhoneDigits(rawValue);

      if (!/^[26]\d{8}$/.test(phoneDigits)) {
        return {
          isValid: false,
          normalizedValue,
          error:
            "Le numero semble invalide pour le Cameroun. Veuillez utilisez 9 chiffres comme 6XXXXXXXX ou 2XXXXXXXX, avec ou sans +237.",
        };
      }

      return {
        isValid: true,
        normalizedValue: `+237${phoneDigits}`,
      };
    }
    default:
      return { isValid: true, normalizedValue };
  }
}

export function applyDraftFieldAnswer(
  draft: OrderDraft,
  field: RequiredDraftField,
  rawValue: string
): OrderDraft {
  const value = validateDraftFieldAnswer(field, rawValue).normalizedValue;

  switch (field) {
    case "siteAddress":
      return createOrderDraft({
        ...draft,
        siteInfo: { ...draft.siteInfo, address: value },
        contactInfo: draft.contactInfo,
        totalAmount: draft.totalAmount,
      });
    case "contactName":
      return createOrderDraft({
        ...draft,
        siteInfo: draft.siteInfo,
        contactInfo: { ...draft.contactInfo, name: value },
        totalAmount: draft.totalAmount,
      });
    case "contactPhone":
      return createOrderDraft({
        ...draft,
        siteInfo: draft.siteInfo,
        contactInfo: { ...draft.contactInfo, phone: value },
        totalAmount: draft.totalAmount,
      });
    default:
      return draft;
  }
}

export function validateOrderDraft(draft: OrderDraft | null): string | null {
  if (!draft) return "Brouillon de commande introuvable.";
  if (!draft.selectedSupplier?.id) return "Aucun fournisseur selectionne.";
  if (!draft.cart?.length) return "Le panier est vide.";
  if (!draft.siteInfo.address.trim()) return "Le quartier de livraison est manquant.";
  if (!draft.contactInfo.name.trim()) return "Le nom du contact est manquant.";
  if (!draft.contactInfo.phone.trim()) return "Le numero du contact est manquant.";

  return null;
}

export function extractRequestedQuantity(message: string): number | null {
  const match = normalizeAssistantText(message).match(/\b\d+(?:[.,]\d+)?\b/);

  if (!match) {
    return null;
  }

  const quantity = Number.parseFloat(match[0].replace(",", "."));

  return Number.isFinite(quantity) && quantity > 0 ? quantity : null;
}

export function findMaterialMatches(
  query: string,
  materials: RecommendationMaterial[]
): MaterialMatch[] {
  return materials
    .map((material) => ({
      material,
      score: scoreMaterialMatch(query, material),
    }))
    .filter((match) => match.score >= 20)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);
}

export function isConfidentMaterialMatch(matches: MaterialMatch[]) {
  if (!matches.length) {
    return false;
  }

  const [best, second] = matches;

  return !second || best.score >= second.score + 18 || best.score >= 90;
}

export function recommendSupplierForMaterial(input: {
  context: RecommendationContext;
  materialId: string;
  quantity: number;
}) {
  const { context, materialId, quantity } = input;
  const cityKey = normalizeAssistantText(context.city);
  const siteCoords = CITY_COORDS[cityKey] || CITY_COORDS.douala;
  const eligibleSuppliers = context.suppliers.filter((supplier) =>
    supplier.supplier_materials.some((item) => item.material_id === materialId)
  );

  if (!eligibleSuppliers.length) {
    return null;
  }

  const allPrices = eligibleSuppliers.map(
    (supplier) =>
      supplier.supplier_materials.find((item) => item.material_id === materialId)?.price || 0
  );
  const allDistances = eligibleSuppliers.map((supplier) =>
    calculateDistance(siteCoords, { lat: supplier.lat, lng: supplier.lng })
  );

  const ranked = eligibleSuppliers
    .map((supplier) => {
      const matchedMaterial = supplier.supplier_materials.find(
        (item) => item.material_id === materialId
      );
      const distanceKm = calculateDistance(siteCoords, {
        lat: supplier.lat,
        lng: supplier.lng,
      });

      return {
        supplier,
        matchedMaterial,
        distanceKm,
        score: scoreSupplier({
          supplier,
          siteCoords,
          materialId,
          allPrices,
          allDistances,
        }),
      };
    })
    .sort((left, right) => right.score - left.score);

  const best = ranked[0];

  if (!best?.matchedMaterial) {
    return null;
  }

  return {
    ...best,
    draft: createOrderDraft({
      selectedSupplier: best.supplier,
      cart: [{ materialId, quantity }],
      siteInfo: { city: context.city },
    }),
  };
}

export function getCompatibleSuppliersForMaterial(
  context: RecommendationContext,
  materialId: string | null
) {
  if (!materialId) {
    return context.suppliers;
  }

  return context.suppliers.filter((supplier) =>
    supplier.supplier_materials.some((item) => item.material_id === materialId)
  );
}
