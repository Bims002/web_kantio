import SupplierExplorer from "@/components/SupplierExplorer";
import { supabase } from "@/lib/supabase";

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; material?: string; q?: string }>;
}) {
  const { city, material, q } = await searchParams;

  const { data: suppliers } = await supabase
    .from("suppliers")
    .select(
      `
      *,
      supplier_materials (
        *,
        material:materials (*)
      )
    `
    )
    .eq("is_active", true);

  return (
    <SupplierExplorer
      suppliers={suppliers || []}
      initialCity={city}
      initialMaterial={material}
      initialQuery={q}
    />
  );
}
