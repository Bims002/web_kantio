import SupplierMap from "@/components/SupplierMap";
import {
  formatCityLabel,
  getCanonicalCityLabel,
  isMatchingCity,
  normalizeCityKey,
} from "@/lib/cities";
import { supabase } from "@/lib/supabase";
import type { Supplier } from "@/lib/types";
import { ArrowRight, MapPin, ShieldCheck } from "lucide-react";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>;
}) {
  const { city } = await searchParams;
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("*")
    .eq("is_active", true);

  const cityLabel = getCanonicalCityLabel(city);
  const cityKey = normalizeCityKey(cityLabel);

  const activeSuppliers = (suppliers || []) as Supplier[];
  const mapSuppliers = cityLabel
    ? activeSuppliers.filter((supplier) => isMatchingCity(supplier.city, cityLabel))
    : activeSuppliers;

  const mapCenter: [number, number] =
    cityKey === "yaounde"
      ? [11.5167, 3.8667]
      : cityKey === "douala"
        ? [9.7, 4.05]
        : [11.5167, 3.8667];

  const mapZoom = cityLabel ? 10 : 6;

  return (
    <div className="shell space-y-6 py-8 sm:space-y-8 sm:py-12">
      <section className="panel overflow-hidden p-3 sm:p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)]">
          <div className="relative min-h-[320px] overflow-hidden rounded-[26px] bg-white sm:min-h-[420px]">
            <div className="absolute inset-x-4 top-4 z-10 flex flex-wrap gap-3">
              <div className="panel-soft px-4 py-3 text-sm">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-kantioo-muted">
                  Couverture active
                </p>
                <p className="mt-1 font-semibold text-kantioo-dark">
                  {cityLabel || "Douala et Yaoundé"}
                </p>
              </div>
              <div className="panel-soft px-4 py-3 text-sm">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-kantioo-muted">
                  Fournisseurs visibles
                </p>
                <p className="mt-1 font-semibold text-kantioo-dark">
                  {mapSuppliers.length}
                </p>
              </div>
            </div>
            <SupplierMap suppliers={mapSuppliers} center={mapCenter} zoom={mapZoom} />
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)]">
        <section className="panel px-6 py-8 sm:px-8 sm:py-10">
          <h1 className="section-title mt-3">Trouver un fournisseur en 2 minutes</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-kantioo-muted">
            Vous choisissez la ville ici. Ensuite, l assistant prend le relais pour
            comprendre le materiau, la quantite et recommander le bon fournisseur.
          </p>

          <form
            action="/assistant-commande"
            className="mt-8 grid gap-4 rounded-[30px] border border-kantioo-line bg-kantioo-sand/70 p-4 md:grid-cols-[minmax(0,1fr)_auto]"
          >
            <label className="rounded-[22px] bg-white px-4 py-3 ring-1 ring-kantioo-line">
              <span className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-kantioo-muted">
                Ville du chantier
              </span>
              <select
                name="city"
                defaultValue={city || ""}
                className="w-full bg-transparent text-sm font-semibold text-kantioo-dark outline-none"
              >
                <option value="">Selectionnez une ville</option>
                <option value="douala">Douala</option>
                <option value="yaounde">Yaoundé</option>
              </select>
            </label>

            <button className="action-primary gap-2">
              Commander
              <ArrowRight size={16} />
            </button>
          </form>
        </section>

        <aside className="panel p-6">
          <div className="space-y-3">
            <div className="rounded-[22px] bg-white px-4 py-4 ring-1 ring-kantioo-line">
              <p className="flex items-center gap-2 text-sm font-semibold text-kantioo-dark">
                <MapPin size={16} className="text-kantioo-orange" />
                Ville
              </p>
              <p className="mt-2 text-sm leading-6 text-kantioo-muted">
                {formatCityLabel(cityLabel) || "Choisissez une ville pour filtrer les fournisseurs."}
              </p>
            </div>
            <div className="rounded-[22px] bg-white px-4 py-4 ring-1 ring-kantioo-line">
              <p className="flex items-center gap-2 text-sm font-semibold text-kantioo-dark">
                <ShieldCheck size={16} className="text-kantioo-orange" />
                Parcours
              </p>
              <p className="mt-2 text-sm leading-6 text-kantioo-muted">
                La ville se choisit ici, puis le chat comprend votre besoin et finalise la commande.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
