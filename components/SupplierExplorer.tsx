"use client";

import { formatCityLabel, normalizeCityKey } from "@/lib/cities";
import type { Supplier } from "@/lib/types";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
  Truck,
} from "lucide-react";
import SupplierMap from "./SupplierMap";

type SupplierWithMaterials = Supplier & {
  supplier_materials: Array<{
    id: string;
    material_id: string;
    price: number;
    unit: string;
    material?: {
      name: string;
      icon: string | null;
    };
  }>;
};

interface Props {
  suppliers: SupplierWithMaterials[];
  initialCity?: string;
  initialMaterial?: string;
  initialQuery?: string;
}

export default function SupplierExplorer({
  suppliers,
  initialCity = "",
  initialMaterial = "",
  initialQuery = "",
}: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [city, setCity] = useState(initialCity);
  const [material, setMaterial] = useState(initialMaterial);

  const cities = Array.from(
    new Set(suppliers.map((supplier) => formatCityLabel(supplier.city)))
  ).sort();
  const materials = Array.from(
    new Set(
      suppliers.flatMap((supplier) =>
        supplier.supplier_materials.map((item) => item.material?.name).filter(Boolean)
      )
    )
  ).sort() as string[];

  const normalizedQuery = query.trim().toLowerCase();
  const normalizedMaterial = material.trim().toLowerCase();
  const normalizedCity = normalizeCityKey(city);

  const filteredSuppliers = suppliers.filter((supplier) => {
    const matchesQuery =
      normalizedQuery.length === 0 ||
      supplier.name.toLowerCase().includes(normalizedQuery) ||
      supplier.quartier?.toLowerCase().includes(normalizedQuery);

    const matchesCity =
      normalizedCity.length === 0 ||
      normalizeCityKey(supplier.city).includes(normalizedCity);

    const matchesMaterial =
      normalizedMaterial.length === 0 ||
      supplier.supplier_materials.some((item) => {
        const materialName = item.material?.name.toLowerCase() || "";

        return (
          item.material_id === material ||
          materialName === normalizedMaterial ||
          materialName.includes(normalizedMaterial)
        );
      });

    return matchesQuery && matchesCity && matchesMaterial;
  });

  return (
    <section className="shell py-10 sm:py-14">
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <span className="eyebrow">Explorer le reseau</span>
          <h1 className="section-title mt-3">
            Comparez les fournisseurs par zone, delai et catalogue.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-kantioo-muted sm:text-lg">
            Filtrez rapidement par ville, besoin chantier ou type de materiau. La liste et la carte restent synchronisees.
          </p>
        </div>

        <div className="panel-soft flex flex-wrap items-center gap-3 px-4 py-3 text-sm text-kantioo-muted">
          <Sparkles size={16} className="text-kantioo-orange" />
          <span>{filteredSuppliers.length} fournisseurs affiches</span>
          <span className="hidden h-1 w-1 rounded-full bg-kantioo-muted/40 sm:block" />
          <span>{cities.length} villes actives</span>
        </div>
      </div>

      <div className="panel mb-8 overflow-hidden">
        <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1.3fr)_repeat(2,minmax(0,1fr))_auto] md:p-5">
          <label className="flex items-center gap-3 rounded-[22px] border border-kantioo-line bg-white px-4 py-3">
            <Search size={18} className="text-kantioo-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nom, quartier, besoin chantier"
              className="w-full bg-transparent text-sm font-medium text-kantioo-dark outline-none placeholder:text-kantioo-muted/70"
            />
          </label>

          <label className="rounded-[22px] border border-kantioo-line bg-white px-4 py-3">
            <span className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-[0.25em] text-kantioo-muted">
              Ville
            </span>
            <select
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className="w-full bg-transparent text-sm font-semibold text-kantioo-dark outline-none"
            >
              <option value="">Toutes les villes</option>
              {cities.map((item) => (
                <option key={item} value={item}>
                  {formatCityLabel(item)}
                </option>
              ))}
            </select>
          </label>

          <label className="rounded-[22px] border border-kantioo-line bg-white px-4 py-3">
            <span className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-[0.25em] text-kantioo-muted">
              Materiau
            </span>
            <select
              value={material}
              onChange={(event) => setMaterial(event.target.value)}
              className="w-full bg-transparent text-sm font-semibold text-kantioo-dark outline-none"
            >
              <option value="">Tout le catalogue</option>
              {materials.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCity("");
              setMaterial("");
            }}
            className="action-secondary gap-2"
          >
            <SlidersHorizontal size={16} />
            Reinitialiser
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <aside className="space-y-4 xl:max-h-[72vh] xl:overflow-y-auto xl:pr-1">
          {filteredSuppliers.map((supplier) => {
            const previewItems = supplier.supplier_materials.slice(0, 4);
            const bestPrice = supplier.supplier_materials.reduce<number | null>(
              (current, item) =>
                current === null || item.price < current ? item.price : current,
              null
            );

            return (
              <Link
                key={supplier.id}
                href={`/fournisseurs/${supplier.id}`}
                className="panel block p-5 hover:-translate-y-1 hover:border-kantioo-orange/30"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="display text-2xl font-bold tracking-[-0.04em] text-kantioo-dark">
                      {supplier.name}
                    </p>
                    <p className="mt-2 flex items-center gap-2 text-sm text-kantioo-muted">
                      <MapPin size={15} className="text-kantioo-orange" />
                      {supplier.quartier ? `${supplier.quartier}, ` : ""}
                      {formatCityLabel(supplier.city)}
                    </p>
                  </div>
                  <span className="rounded-full bg-kantioo-sand px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-kantioo-orange">
                    Actif
                  </span>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {previewItems.map((item) => (
                    <span
                      key={item.id}
                      className="rounded-full border border-kantioo-line bg-white px-3 py-1.5 text-xs font-medium text-kantioo-dark"
                    >
                      {item.material?.name || "Materiau"}
                    </span>
                  ))}
                  {supplier.supplier_materials.length > previewItems.length && (
                    <span className="rounded-full border border-dashed border-kantioo-line px-3 py-1.5 text-xs font-medium text-kantioo-muted">
                      +{supplier.supplier_materials.length - previewItems.length} references
                    </span>
                  )}
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[22px] bg-kantioo-sand px-4 py-3">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-kantioo-muted">
                      Delai moyen
                    </p>
                    <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-kantioo-dark">
                      <Truck size={16} className="text-kantioo-orange" />
                      {supplier.delivery_delay_hours}h
                    </p>
                  </div>
                  <div className="rounded-[22px] bg-white px-4 py-3 ring-1 ring-kantioo-line">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-kantioo-muted">
                      A partir de
                    </p>
                    <p className="mt-1 text-sm font-semibold text-kantioo-dark">
                      {bestPrice ? `${bestPrice.toLocaleString("fr-FR")} FCFA` : "Sur demande"}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between text-sm font-semibold text-kantioo-dark">
                  <span>Voir le profil</span>
                  <ArrowRight size={18} className="text-kantioo-orange" />
                </div>
              </Link>
            );
          })}

          {filteredSuppliers.length === 0 && (
            <div className="panel p-8 text-center">
              <p className="display text-2xl font-bold tracking-[-0.04em] text-kantioo-dark">
                Aucun fournisseur ne correspond.
              </p>
              <p className="mt-3 text-sm leading-6 text-kantioo-muted">
                Elargissez la ville, retirez le filtre materiau ou utilisez une recherche plus large.
              </p>
            </div>
          )}
        </aside>

        <div className="panel relative min-h-[480px] overflow-hidden p-3 sm:min-h-[620px]">
          <div className="absolute inset-x-5 top-5 z-10 flex flex-wrap gap-3">
            <div className="panel-soft px-4 py-3 text-sm">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-kantioo-muted">
                Zone active
              </p>
              <p className="mt-1 font-semibold text-kantioo-dark">
                Cameroun / Douala / Yaoundé
              </p>
            </div>
            <div className="panel-soft px-4 py-3 text-sm">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-kantioo-muted">
                Matching courant
              </p>
              <p className="mt-1 font-semibold text-kantioo-dark">
                {filteredSuppliers.length} points cartes
              </p>
            </div>
          </div>

          <SupplierMap suppliers={filteredSuppliers} />
        </div>
      </div>
    </section>
  );
}
