"use client";

import { formatCityLabel, normalizeCityKey } from "@/lib/cities";
import type { Supplier } from "@/lib/types";
import Link from "next/link";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  ArrowRight,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
  Truck,
  ShoppingCart,
  X,
  Star,
} from "lucide-react";
import SupplierMap from "./SupplierMap";

type SupplierWithMaterials = Supplier & {
  supplier_materials: Array<{
    id: string;
    material_id: string;
    price?: number;
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

// Smart search suggestions
interface Suggestion {
  type: 'supplier' | 'material' | 'quartier' | 'city';
  label: string;
  id?: string;
  value?: string;
}

function useSmartSearch(suppliers: SupplierWithMaterials[], query: string): Suggestion[] {
  return useMemo(() => {
    if (!query.trim() || query.trim().length < 2) return [];
    
    const q = query.toLowerCase();
    const suggestions: Suggestion[] = [];
    
    // Collect all unique materials, quartiers, cities
    const materialsSet = new Set<string>();
    const quartiersSet = new Set<string>();
    
    suppliers.forEach(s => {
      s.supplier_materials.forEach(item => {
        if (item.material?.name) materialsSet.add(item.material.name);
      });
      if (s.quartier) quartiersSet.add(s.quartier);
    });
    
    // Find matching suppliers
    suppliers.filter(s => s.name.toLowerCase().includes(q)).slice(0, 3).forEach(s => {
      suggestions.push({ type: 'supplier', label: s.name, id: s.id });
    });
    
    // Find matching materials
    Array.from(materialsSet).filter(m => m.toLowerCase().includes(q)).slice(0, 3).forEach(m => {
      suggestions.push({ type: 'material', label: m, value: m });
    });
    
    // Find matching quartiers
    Array.from(quartiersSet).filter(qr => qr.toLowerCase().includes(q)).slice(0, 3).forEach(qr => {
      suggestions.push({ type: 'quartier', label: qr, value: qr });
    });
    
    return suggestions.slice(0, 6);
  }, [suppliers, query]);
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
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cartItems, setCartItems] = useState<Array<{ materialId: string; materialName: string; supplierId: string; supplierName: string; quantity: number }>>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  
  const suggestions = useSmartSearch(suppliers, query);

  // Close suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Add material to cart
  const addToCart = useCallback((item: { materialId: string; materialName: string; supplierId: string; supplierName: string }) => {
    setCartItems(prev => {
      const existing = prev.find(c => c.materialId === item.materialId && c.supplierId === item.supplierId);
      if (existing) {
        return prev.map(c => c.materialId === item.materialId && c.supplierId === item.supplierId ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  }, []);

  // Remove from cart
  const removeFromCart = useCallback((materialId: string, supplierId: string) => {
    setCartItems(prev => prev.filter(c => !(c.materialId === materialId && c.supplierId === supplierId)));
  }, []);

  // Only show Douala and Yaoundé as options
  const CITIES = ['Douala', 'Yaoundé'];
  const cities = CITIES.filter(c => 
    suppliers.some(s => formatCityLabel(s.city) === c)
  );
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

  const handleSuggestionClick = (s: Suggestion) => {
    if (s.type === 'supplier') {
      window.location.href = `/fournisseurs/${s.id}`;
    } else if (s.type === 'material') {
      setMaterial(s.value || '');
      setQuery('');
      setShowSuggestions(false);
    } else if (s.type === 'quartier' || s.type === 'city') {
      setQuery(s.label);
      setShowSuggestions(false);
    }
  };

  return (
    <section className="shell py-10 sm:py-14">
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <span className="eyebrow">Explorer le reseau</span>
          <h1 className="section-title mt-3">
            Comparez les fournisseurs par zone, delai et catalogue.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-kantioo-muted sm:text-lg">
            Filtrez rapidement par ville, besoin chantier ou type de materiau.
          </p>
        </div>

        <div className="panel-soft flex flex-wrap items-center gap-3 px-4 py-3 text-sm text-kantioo-muted">
          <Sparkles size={16} className="text-kantioo-orange" />
          <span>{filteredSuppliers.length} fournisseurs affiches</span>
          <span className="hidden h-1 w-1 rounded-full bg-kantioo-muted/40 sm:block" />
          <span>{cities.length} villes actives</span>
          {cartItems.length > 0 && (
            <>
              <span className="hidden h-1 w-1 rounded-full bg-kantioo-muted/40 sm:block" />
              <span className="flex items-center gap-1">
                <ShoppingCart size={14} /> Panier: {cartItems.length}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="panel mb-8 overflow-hidden">
        <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1.3fr)_repeat(2,minmax(0,1fr))_auto] md:p-5">
          {/* Smart Search */}
          <div ref={searchRef} className="relative">
            <label className="flex items-center gap-3 rounded-[22px] border border-kantioo-line bg-white px-4 py-3">
              <Search size={18} className="text-kantioo-muted" />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Rechercher fournisseur, materiau, quartier..."
                className="w-full bg-transparent text-sm font-medium text-kantioo-dark outline-none placeholder:text-kantioo-muted/70"
              />
              {query && (
                <button type="button" onClick={() => { setQuery(''); setShowSuggestions(false); }} className="text-kantioo-muted hover:text-kantioo-dark">
                  <X size={16} />
                </button>
              )}
            </label>
            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border border-kantioo-line bg-white shadow-lg">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSuggestionClick(s)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-kantioo-sand first:rounded-t-xl last:rounded-b-xl"
                  >
                    {s.type === 'supplier' && <span className="rounded-full bg-kantioo-dark/10 px-2 py-0.5 text-xs">Fournisseur</span>}
                    {s.type === 'material' && <span className="rounded-full bg-kantioo-orange/10 px-2 py-0.5 text-xs">Materiau</span>}
                    {s.type === 'quartier' && <span className="rounded-full bg-kantioo-green/10 px-2 py-0.5 text-xs">Quartier</span>}
                    <span className="font-medium text-kantioo-dark">{s.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* City Filter */}
          <label className="rounded-[22px] border border-kantioo-line bg-white px-4 py-3">
            <span className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-[0.25em] text-kantioo-muted">
              Ville
            </span>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full bg-transparent text-sm font-semibold text-kantioo-dark outline-none"
            >
              <option value="">Toutes les villes</option>
              {cities.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>

          {/* Material Filter */}
          <label className="rounded-[22px] border border-kantioo-line bg-white px-4 py-3">
            <span className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-[0.25em] text-kantioo-muted">
              Materiau
            </span>
            <select
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              className="w-full bg-transparent text-sm font-semibold text-kantioo-dark outline-none"
            >
              <option value="">Tout le catalogue</option>
              {materials.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>

          {/* Reset */}
          <button
            type="button"
            onClick={() => { setQuery(""); setCity(""); setMaterial(""); }}
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

            return (
              <div
                key={supplier.id}
                className="panel p-5 hover:-translate-y-1 hover:border-kantioo-orange/30"
              >
                <Link href={`/fournisseurs/${supplier.id}`}>
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
                      {supplier.supplier_materials.length} articles
                    </span>
                  </div>
                </Link>

                <div className="mt-5 flex flex-wrap gap-2">
                  {previewItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addToCart({
                        materialId: item.material_id,
                        materialName: item.material?.name || 'Materiau',
                        supplierId: supplier.id,
                        supplierName: supplier.name,
                      })}
                      className="rounded-full border border-kantioo-line bg-white px-3 py-1.5 text-xs font-medium text-kantioo-dark hover:border-kantioo-orange/50 hover:bg-kantioo-sand/50 transition-all"
                      title="Ajouter a la commande"
                    >
                      {item.material?.name || "Materiau"}
                    </button>
                  ))}
                  {supplier.supplier_materials.length > previewItems.length && (
                    <Link
                      href={`/fournisseurs/${supplier.id}`}
                      className="rounded-full border border-dashed border-kantioo-line px-3 py-1.5 text-xs font-medium text-kantioo-muted hover:text-kantioo-orange hover:border-kantioo-orange"
                    >
                      +{supplier.supplier_materials.length - previewItems.length}
                    </Link>
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
                    <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-kantioo-dark">
                      <ShoppingCart size={14} className="text-kantioo-orange" />
                      {supplier.supplier_materials.length} materiaux
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between text-sm font-semibold text-kantioo-dark">
                  <Link href={`/fournisseurs/${supplier.id}`} className="flex items-center gap-2 hover:text-kantioo-orange">
                    Voir le profil
                    <ArrowRight size={18} />
                  </Link>
                </div>
              </div>
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
              <button
                type="button"
                onClick={() => { setQuery(""); setCity(""); setMaterial(""); }}
                className="action-secondary mt-4 gap-2"
              >
                <SlidersHorizontal size={16} />
                Reinitialiser les filtres
              </button>
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

      {/* Multi-material cart preview */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-4 right-4 z-30 max-w-sm rounded-2xl border border-kantioo-line bg-white p-4 shadow-lg">
          <h3 className="font-bold text-kantioo-dark flex items-center gap-2">
            <ShoppingCart size={16} className="text-kantioo-orange" />
            Panier ({cartItems.length})
          </h3>
          <div className="mt-2 space-y-1">
            {cartItems.slice(0, 3).map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-kantioo-dark font-medium">{item.materialName}</span>
                <button onClick={() => removeFromCart(item.materialId, item.supplierId)} className="text-red-500 hover:text-red-700">
                  <X size={14} />
                </button>
              </div>
            ))}
            {cartItems.length > 3 && <p className="text-xs text-kantioo-muted">+{cartItems.length - 3} autres...</p>}
          </div>
          <Link
            href={`/assistant-commande?cart=${encodeURIComponent(JSON.stringify(cartItems))}`}
            className="action-primary mt-3 flex w-full justify-center gap-2 text-sm"
          >
            Commander ces articles
            <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </section>
  );
}