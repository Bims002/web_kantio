import OrderAssistant from "@/components/OrderAssistant";
import { getCanonicalCityLabel, isMatchingCity } from "@/lib/cities";
import {
  createOrderDraft,
  type OrderDraft,
  type RecommendationContext,
} from "@/lib/order-assistant";
import { supabase } from "@/lib/supabase";

interface SearchParams {
  supplier?: string;
  material?: string;
  city?: string;
}

export default async function OrderAssistantPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { supplier: supplierId, material: materialId, city } = await searchParams;

  let initialDraft: OrderDraft | null = null;
  let recommendationContext: RecommendationContext | null = null;
  const normalizedCity = getCanonicalCityLabel(city);

  if (supplierId && materialId) {
    const { data: supplier } = await supabase
      .from("suppliers")
      .select("*, supplier_materials(*, material:materials(*))")
      .eq("id", supplierId)
      .eq("is_active", true)
      .single();

    if (supplier) {
      initialDraft = createOrderDraft({
        selectedSupplier: supplier,
        cart: [{ materialId, quantity: 1 }],
        siteInfo: {
          city: normalizedCity || supplier.city,
        },
      });
    }
  }

  if (!initialDraft && normalizedCity) {
    const [{ data: materials }, { data: suppliers }] = await Promise.all([
      supabase.from("materials").select("id, name, category, unit"),
      supabase
        .from("suppliers")
        .select("*, supplier_materials(*, material:materials(name))")
        .eq("is_active", true),
    ]);

    if (materials && suppliers) {
      const filteredSuppliers = suppliers.filter((supplier) =>
        isMatchingCity(supplier.city, normalizedCity)
      );

      recommendationContext = {
        city: normalizedCity,
        materials,
        suppliers: filteredSuppliers,
      };
    }
  }

  return (
    <OrderAssistant
      initialDraft={initialDraft}
      recommendationContext={recommendationContext}
    />
  );
}
