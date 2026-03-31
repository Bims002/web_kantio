'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatCityLabel, getCanonicalCityLabel } from '@/lib/cities';
import { supabase } from '@/lib/supabase';
import { buildWhatsAppLink, generateWhatsAppMessage } from '@/lib/whatsapp';
import type { Material, Order, OrderItem, Supplier, SupplierMaterial } from '@/lib/types';
import {
  Banknote,
  CheckCircle,
  LogOut,
  MessageSquare,
  PackageSearch,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Trash2,
  Truck,
  Upload,
  Users,
  XCircle,
  Eye,
  TrendingUp,
  BarChart3,
} from 'lucide-react';

type AdminTab = 'orders' | 'suppliers' | 'materials' | 'pricing';
type PricingView = 'list' | 'by-supplier' | 'comparison';
type AdjustmentType = 'increase' | 'decrease';

interface AdminOrder extends Order {
  order_items?: OrderItem[];
}

interface AdminPrice extends SupplierMaterial {
  supplier?: Pick<Supplier, 'id' | 'name' | 'city'>;
  material?: Material;
}

interface SupplierForm {
  name: string;
  phone: string;
  contact_name: string;
  email: string;
  city: string;
  quartier: string;
  address: string;
  lat: string;
  lng: string;
  delivery_radius: string;
  delivery_delay_hours: string;
  stock_availability: Supplier['stock_availability'];
  is_active: boolean;
}

interface MaterialForm {
  name: string;
  category: string;
  unit: string;
  icon: string;
}

interface PriceForm {
  supplier_id: string;
  material_id: string;
  price: string;
  unit: string;
}

const emptySupplier = (): SupplierForm => ({
  name: '',
  phone: '',
  contact_name: '',
  email: '',
  city: 'Douala',
  quartier: '',
  address: '',
  lat: '',
  lng: '',
  delivery_radius: '20',
  delivery_delay_hours: '24',
  stock_availability: 'permanent',
  is_active: true,
});

const emptyMaterial = (): MaterialForm => ({
  name: '',
  category: '',
  unit: '',
  icon: '',
});

const emptyPrice = (): PriceForm => ({
  supplier_id: '',
  material_id: '',
  price: '',
  unit: '',
});

const statusTone: Record<AdminOrder['status'], string> = {
  pending: 'bg-kantioo-dark text-white',
  confirmed: 'bg-blue-600 text-white',
  in_delivery: 'bg-purple-600 text-white',
  delivered: 'bg-kantioo-green text-white',
  cancelled: 'bg-red-600 text-white',
};

// ---- Helper: call admin API routes (for WRITE operations only) ----

async function adminFetch<T = unknown>(
  url: string,
  options?: RequestInit
): Promise<{ data?: T; error?: string }> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
    });

    // Guard against non-JSON responses (e.g. HTML error pages)
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return { error: `Le serveur a repondu avec un format inattendu (${response.status}).` };
    }

    const json = await response.json();

    if (!response.ok) {
      return { error: json.error || `Erreur ${response.status}` };
    }

    return { data: json as T };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erreur reseau.' };
  }
}

export default function AdminWorkspace({ adminEmail }: { adminEmail: string }) {
  const [activeTab, setActiveTab] = useState<AdminTab>('orders');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [prices, setPrices] = useState<AdminPrice[]>([]);

  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [supplierForm, setSupplierForm] = useState<SupplierForm>(emptySupplier);
  const [materialForm, setMaterialForm] = useState<MaterialForm>(emptyMaterial);
  const [priceForm, setPriceForm] = useState<PriceForm>(emptyPrice);
  const [searchQuery, setSearchQuery] = useState('');

  // Pricing view state
  const [pricingView, setPricingView] = useState<PricingView>('list');
  const [selectedSupplierForEdit, setSelectedSupplierForEdit] = useState<string | null>(null);
  const [editablePrices, setEditablePrices] = useState<Record<string, string>>({});
  const [adjustmentPercent, setAdjustmentPercent] = useState<string>('5');
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('increase');

  const normalizedSearch = searchQuery.toLowerCase().trim();

  const filteredOrders = useMemo(() => {
    if (!normalizedSearch) return orders;
    return orders.filter(o => 
      o.site_name?.toLowerCase().includes(normalizedSearch) ||
      o.contact_name?.toLowerCase().includes(normalizedSearch) ||
      o.contact_phone?.toLowerCase().includes(normalizedSearch) ||
      o.supplier_name?.toLowerCase().includes(normalizedSearch) ||
      o.tracking_token?.toLowerCase().includes(normalizedSearch)
    );
  }, [orders, normalizedSearch]);

  const filteredSuppliers = useMemo(() => {
    if (!normalizedSearch) return suppliers;
    return suppliers.filter(s => 
      s.name.toLowerCase().includes(normalizedSearch) ||
      s.city.toLowerCase().includes(normalizedSearch) ||
      s.phone.toLowerCase().includes(normalizedSearch)
    );
  }, [suppliers, normalizedSearch]);

  const filteredMaterials = useMemo(() => {
    if (!normalizedSearch) return materials;
    return materials.filter(m => 
      m.name.toLowerCase().includes(normalizedSearch) ||
      m.category?.toLowerCase().includes(normalizedSearch)
    );
  }, [materials, normalizedSearch]);

  const filteredPrices = useMemo(() => {
    if (!normalizedSearch) return prices;
    return prices.filter(p => 
      p.supplier?.name.toLowerCase().includes(normalizedSearch) ||
      p.material?.name.toLowerCase().includes(normalizedSearch)
    );
  }, [prices, normalizedSearch]);

  // Extract unique categories from materials
  const uniqueCategories = useMemo(() => {
    const categories = new Set<string>();
    materials.forEach((material) => {
      if (material.category) {
        categories.add(material.category);
      }
    });
    return Array.from(categories).sort();
  }, [materials]);

  // ---- READ via Supabase anon client (RLS allows SELECT on all tables) ----

  const refreshAll = async () => {
    setRefreshing(true);
    try {
      const [ordersRes, suppliersRes, materialsRes, pricesRes] = await Promise.all([
        supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }),
        supabase.from('suppliers').select('*').order('name'),
        supabase.from('materials').select('*').order('name'),
        supabase.from('supplier_materials').select('*, supplier:suppliers(id,name,city), material:materials(*)'),
      ]);

      if (ordersRes.error) throw ordersRes.error;
      if (suppliersRes.error) throw suppliersRes.error;
      if (materialsRes.error) throw materialsRes.error;
      if (pricesRes.error) throw pricesRes.error;

      setOrders((ordersRes.data || []) as AdminOrder[]);
      setSuppliers((suppliersRes.data || []) as Supplier[]);
      setMaterials((materialsRes.data || []) as Material[]);
      setPrices((pricesRes.data || []) as AdminPrice[]);
      setMessage(null);
    } catch (error) {
      console.error('Admin refresh error', error);
      setMessage({ type: 'error', text: "Impossible d'actualiser l'espace admin." });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalRevenue = useMemo(
    () => orders.reduce((sum, order) => sum + (order.total_price || 0), 0),
    [orders]
  );

  const resetSupplierForm = () => {
    setEditingSupplierId(null);
    setSupplierForm(emptySupplier());
  };

  const resetMaterialForm = () => {
    setEditingMaterialId(null);
    setMaterialForm(emptyMaterial());
  };

  const resetPriceForm = () => {
    setEditingPriceId(null);
    setPriceForm(emptyPrice());
  };

  // ---- WRITE operations go through admin API routes (server-side service role key) ----

  const saveSupplier = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      name: supplierForm.name.trim(),
      phone: supplierForm.phone.trim(),
      contact_name: supplierForm.contact_name.trim() || null,
      email: supplierForm.email.trim() || null,
      city: getCanonicalCityLabel(supplierForm.city),
      quartier: supplierForm.quartier.trim() || null,
      address: supplierForm.address.trim() || null,
      lat: Number.parseFloat(supplierForm.lat) || 0,
      lng: Number.parseFloat(supplierForm.lng) || 0,
      delivery_radius: Number.parseFloat(supplierForm.delivery_radius) || 20,
      delivery_delay_hours: Number.parseInt(supplierForm.delivery_delay_hours, 10) || 24,
      stock_availability: supplierForm.stock_availability,
      is_active: supplierForm.is_active,
    };
    if (!payload.name || !payload.phone) {
      setMessage({ type: 'error', text: 'Le nom et le numero du fournisseur sont obligatoires.' });
      return;
    }

    const url = editingSupplierId
      ? `/api/admin/suppliers/${editingSupplierId}`
      : '/api/admin/suppliers';
    const method = editingSupplierId ? 'PATCH' : 'POST';

    const { error } = await adminFetch(url, {
      method,
      body: JSON.stringify(payload),
    });

    if (error) {
      setMessage({ type: 'error', text: error });
      return;
    }
    setMessage({ type: 'success', text: 'Fournisseur enregistre.' });
    resetSupplierForm();
    await refreshAll();
  };

  const saveMaterial = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      name: materialForm.name.trim(),
      category: materialForm.category.trim(),
      unit: materialForm.unit.trim(),
      icon: materialForm.icon.trim() || null,
    };
    if (!payload.name || !payload.category || !payload.unit || payload.category === '__new__') {
      setMessage({ type: 'error', text: 'Nom, categorie (non-vide) et unite sont obligatoires.' });
      return;
    }

    const url = editingMaterialId
      ? `/api/admin/materials/${editingMaterialId}`
      : '/api/admin/materials';
    const method = editingMaterialId ? 'PATCH' : 'POST';

    const { error } = await adminFetch(url, {
      method,
      body: JSON.stringify(payload),
    });

    if (error) {
      setMessage({ type: 'error', text: error });
      return;
    }
    setMessage({ type: 'success', text: 'Article enregistre.' });
    resetMaterialForm();
    await refreshAll();
  };

  const savePrice = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      supplier_id: priceForm.supplier_id,
      material_id: priceForm.material_id,
      price: Number.parseFloat(priceForm.price) || 0,
      unit: priceForm.unit.trim(),
    };
    if (!payload.supplier_id || !payload.material_id || !payload.price || !payload.unit) {
      setMessage({ type: 'error', text: 'Fournisseur, article, prix et unite sont obligatoires.' });
      return;
    }

    const url = editingPriceId
      ? `/api/admin/pricing/${editingPriceId}`
      : '/api/admin/pricing';
    const method = editingPriceId ? 'PATCH' : 'POST';

    const { error } = await adminFetch(url, {
      method,
      body: JSON.stringify(payload),
    });

    if (error) {
      setMessage({ type: 'error', text: error });
      return;
    }
    setMessage({ type: 'success', text: 'Tarif enregistre.' });
    resetPriceForm();
    await refreshAll();
  };

  const removeRecord = async (table: 'suppliers' | 'materials' | 'supplier_materials', id: string) => {
    if (!window.confirm('Confirmer la suppression ?')) {
      return;
    }

    // Map table name to admin API route
    const routeMap: Record<string, string> = {
      suppliers: `/api/admin/suppliers/${id}`,
      materials: `/api/admin/materials/${id}`,
      supplier_materials: `/api/admin/pricing/${id}`,
    };

    const { error } = await adminFetch(routeMap[table], {
      method: 'DELETE',
    });

    if (error) {
      setMessage({ type: 'error', text: error });
      return;
    }
    setMessage({ type: 'success', text: 'Suppression effectuee.' });
    await refreshAll();
  };

  const updateOrderStatus = async (orderId: string, status: AdminOrder['status']) => {
    const { data, error } = await adminFetch<{ order: AdminOrder }>(
      `/api/admin/orders/${orderId}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }
    );

    if (error) {
      setMessage({ type: 'error', text: error });
      return;
    }

    // Update local state with server response
    if (data?.order) {
      setOrders((current) =>
        current.map((order) => (order.id === orderId ? { ...data.order, order_items: order.order_items } : order))
      );
    }
    setMessage({ type: 'success', text: 'Statut mis a jour.' });
  };

  const handleLogout = async () => {
    if (!window.confirm('Confirmer la deconnexion ?')) return;
    await fetch('/api/admin/logout', { method: 'POST' });
    window.location.reload();
  };

  // Pricing adjustments
  const applyPercentageAdjustment = async (supplierId: string, percent: number) => {
    if (!window.confirm(`Appliquer ${adjustmentType === 'increase' ? '+' : '-'}${percent}% à tous les tarifs de ce fournisseur ?`)) {
      return;
    }

    setRefreshing(true);
    try {
      const supplierPrices = prices.filter((p) => p.supplier_id === supplierId);
      const updates = await Promise.all(
        supplierPrices.map((price) => {
          const factor = adjustmentType === 'increase' ? 1 + percent / 100 : 1 - percent / 100;
          const newPrice = Math.round(price.price * factor);
          return adminFetch(`/api/admin/pricing/${price.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              supplier_id: price.supplier_id,
              material_id: price.material_id,
              price: newPrice,
              unit: price.unit,
            }),
          });
        })
      );

      const hasError = updates.some((u) => u.error);
      if (hasError) {
        setMessage({ type: 'error', text: 'Erreur lors de la mise a jour de certains tarifs.' });
      } else {
        setMessage({ type: 'success', text: `${adjustmentType === 'increase' ? '+' : '-'}${percent}% applique avec succes.` });
      }
      await refreshAll();
    } catch (error) {
      setMessage({ type: 'error', text: 'Erreur lors de l\'ajustement des tarifs.' });
    } finally {
      setRefreshing(false);
    }
  };

  const saveEditablePrices = async () => {
    if (!Object.keys(editablePrices).length) {
      setMessage({ type: 'error', text: 'Aucune modification a enregistrer.' });
      return;
    }

    setRefreshing(true);
    try {
      const updates = Object.entries(editablePrices).map(([priceId, newPrice]) => {
        const price = prices.find((p) => p.id === priceId);
        if (!price) return Promise.resolve({ error: null });
        return adminFetch(`/api/admin/pricing/${priceId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            supplier_id: price.supplier_id,
            material_id: price.material_id,
            price: Number.parseFloat(newPrice) || 0,
            unit: price.unit,
          }),
        });
      });

      const results = await Promise.all(updates);
      const hasError = results.some((r) => r.error);
      if (hasError) {
        setMessage({ type: 'error', text: 'Erreur lors de l\'enregistrement de certains tarifs.' });
      } else {
        setMessage({ type: 'success', text: 'Tarifs enregistres avec succes.' });
        setEditablePrices({});
      }
      await refreshAll();
    } catch (error) {
      setMessage({ type: 'error', text: 'Erreur lors de l\'enregistrement.' });
    } finally {
      setRefreshing(false);
    }
  };

  // Pricing data compilation
  const pricesBySupplier = useMemo(() => {
    const map: Record<string, AdminPrice[]> = {};
    prices.forEach((price) => {
      const key = price.supplier_id;
      if (!map[key]) map[key] = [];
      map[key].push(price);
    });
    return map;
  }, [prices]);

  const pricesByMaterial = useMemo(() => {
    const map: Record<string, AdminPrice[]> = {};
    prices.forEach((price) => {
      const key = price.material_id;
      if (!map[key]) map[key] = [];
      map[key].push(price);
    });
    return map;
  }, [prices]);

  const handleCsvImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!window.confirm(`Voulez-vous importer le fichier ${file.name} ?`)) {
      event.target.value = '';
      return;
    }

    setRefreshing(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/suppliers/import', {
        method: 'POST',
        body: formData,
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || "Erreur lors de l'import");
      }

      setMessage({ type: 'success', text: `${json.inserted} fournisseurs importes avec succes !` });
      await refreshAll();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : "Erreur reseau." });
    } finally {
      setRefreshing(false);
      event.target.value = '';
    }
  };

  const activeSuppliersCount = suppliers.filter((supplier) => supplier.is_active).length;

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Chargement admin...</div>;
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto flex max-w-[1680px] flex-col gap-8 px-4 py-8 lg:flex-row lg:px-8">
        <aside className="panel h-fit w-full p-6 lg:sticky lg:top-8 lg:w-[280px]">
          <h1 className="text-3xl font-black tracking-tight text-kantioo-dark">
            Kantioo <span className="text-kantioo-orange">Admin</span>
          </h1>
          <p className="mt-3 text-sm leading-6 text-kantioo-muted">
            Connecte en tant que <span className="font-bold text-kantioo-dark">{adminEmail}</span>. Gestion des fournisseurs, des articles, des tarifs et des commandes.
          </p>

          <div className="mt-6 space-y-2">
            {[
              { id: 'orders' as const, label: 'Commandes', icon: ShoppingBag },
              { id: 'suppliers' as const, label: 'Fournisseurs', icon: Users },
              { id: 'materials' as const, label: 'Articles', icon: PackageSearch },
              { id: 'pricing' as const, label: 'Tarifs', icon: Banknote },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.id === activeTab;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSearchQuery('');
                  }}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold ${
                    isActive
                      ? 'border-kantioo-dark bg-kantioo-dark text-white'
                      : 'border-kantioo-line bg-white text-kantioo-dark hover:bg-kantioo-sand'
                  }`}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <button type="button" onClick={() => void refreshAll()} className="action-secondary mt-6 w-full justify-center gap-2">
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            Actualiser
          </button>

          <button type="button" onClick={() => void handleLogout()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100">
            <LogOut size={16} />
            Se deconnecter
          </button>
        </aside>

        <main className="min-w-0 flex-1 space-y-8">
          <header className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="panel px-5 py-4">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-kantioo-muted">CA estime</p>
              <p className="mt-2 text-xl font-black text-kantioo-dark">{totalRevenue.toLocaleString('fr-FR')} FCFA</p>
            </div>
            <div className="panel px-5 py-4">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-kantioo-muted">Commandes</p>
              <p className="mt-2 text-xl font-black text-kantioo-dark">{orders.length}</p>
            </div>
            <div className="panel px-5 py-4">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-kantioo-muted">Fournisseurs actifs</p>
              <p className="mt-2 text-xl font-black text-kantioo-dark">{activeSuppliersCount}</p>
            </div>
            <div className="panel px-5 py-4">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-kantioo-muted">Articles</p>
              <p className="mt-2 text-xl font-black text-kantioo-dark">{materials.length}</p>
            </div>
          </header>

          {message ? (
            <div className={`rounded-[20px] px-5 py-4 text-sm ${message.type === 'success' ? 'border border-emerald-200 bg-emerald-50 text-emerald-800' : 'border border-red-200 bg-red-50 text-red-700'}`}>
              {message.text}
            </div>
          ) : null}

          <div className="relative">
            <span className="absolute inset-y-0 left-4 flex items-center text-kantioo-muted">
              <Search size={20} />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher..."
              className="w-full rounded-[20px] border border-kantioo-line bg-white px-5 py-3 pl-12 text-sm text-kantioo-dark shadow-sm outline-none focus:border-kantioo-dark focus:ring-1 focus:ring-kantioo-dark"
            />
          </div>

          {activeTab === 'orders' ? (
            <div className="space-y-4">
              {filteredOrders.map((order) => (
                <div key={order.id} className="panel flex flex-col gap-5 p-6 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-full bg-kantioo-sand px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-kantioo-dark">#{order.tracking_token}</span>
                      <span className={`rounded-full px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] ${statusTone[order.status]}`}>{order.status}</span>
                    </div>
                    <h3 className="mt-4 text-2xl font-black tracking-tight text-kantioo-dark">{order.site_name}</h3>
                    <p className="mt-2 text-sm text-kantioo-muted">{order.site_address}</p>
                    <p className="mt-3 text-sm text-kantioo-dark">{order.contact_name} · {order.contact_phone}</p>
                    <p className="mt-1 text-sm text-kantioo-muted">{order.supplier_name || 'Sans fournisseur'} · {(order.total_price || 0).toLocaleString('fr-FR')} FCFA</p>
                  </div>
                  <div className="flex flex-col gap-3 xl:w-[320px]">
                    {(() => {
                      const supplier = suppliers.find((s) => s.id === order.supplier_id);
                      return (
                        <a
                          href={buildWhatsAppLink(generateWhatsAppMessage(order))}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center gap-2 rounded-full bg-kantioo-green px-5 py-3 text-sm font-semibold text-white"
                        >
                          <MessageSquare size={16} />
                          WhatsApp
                        </a>
                      );
                    })()}
                    <div className="grid grid-cols-2 gap-3">
                      <button type="button" onClick={() => void updateOrderStatus(order.id, 'confirmed')} className="action-secondary justify-center gap-2"><CheckCircle size={16} />Confirmer</button>
                      <button type="button" onClick={() => void updateOrderStatus(order.id, 'in_delivery')} className="action-secondary justify-center gap-2"><Truck size={16} />Livraison</button>
                      <button type="button" onClick={() => void updateOrderStatus(order.id, 'delivered')} className="action-secondary justify-center gap-2"><CheckCircle size={16} />Livree</button>
                      <button type="button" onClick={() => void updateOrderStatus(order.id, 'cancelled')} className="inline-flex items-center justify-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"><XCircle size={16} />Annuler</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {activeTab !== 'orders' ? (
            <div className="grid gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
              <section className="panel p-6">
                {activeTab === 'suppliers' ? (
                  <form onSubmit={saveSupplier} className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-2xl font-black tracking-tight text-kantioo-dark">{editingSupplierId ? 'Modifier un fournisseur' : 'Ajouter un fournisseur'}</h3>
                      {!editingSupplierId && (
                        <div className="relative overflow-hidden rounded-full border border-kantioo-line bg-white hover:bg-kantioo-sand">
                          <input 
                            type="file" 
                            accept=".csv" 
                            onChange={handleCsvImport}
                            className="absolute inset-0 z-10 w-full h-full cursor-pointer opacity-0"
                            disabled={refreshing}
                            title="Importer un CSV"
                          />
                          <div className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-kantioo-dark">
                            <Upload size={16} /> Importer CSV
                          </div>
                        </div>
                      )}
                    </div>
                    <input value={supplierForm.name} onChange={(event) => setSupplierForm((current) => ({ ...current, name: event.target.value }))} placeholder="Nom du fournisseur" className="w-full rounded-[18px] border border-kantioo-line px-4 py-3 outline-none" />
                    <input value={supplierForm.phone} onChange={(event) => setSupplierForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Numero" className="w-full rounded-[18px] border border-kantioo-line px-4 py-3 outline-none" />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <input value={supplierForm.contact_name} onChange={(event) => setSupplierForm((current) => ({ ...current, contact_name: event.target.value }))} placeholder="Nom du contact" className="w-full rounded-[18px] border border-kantioo-line px-4 py-3 outline-none" />
                      <input value={supplierForm.email} onChange={(event) => setSupplierForm((current) => ({ ...current, email: event.target.value }))} placeholder="Email" className="w-full rounded-[18px] border border-kantioo-line px-4 py-3 outline-none" />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <select value={supplierForm.city} onChange={(event) => setSupplierForm((current) => ({ ...current, city: event.target.value }))} className="w-full rounded-[18px] border border-kantioo-line px-4 py-3 outline-none"><option value="Douala">Douala</option><option value="Yaoundé">Yaoundé</option></select>
                      <input value={supplierForm.quartier} onChange={(event) => setSupplierForm((current) => ({ ...current, quartier: event.target.value }))} placeholder="Quartier" className="w-full rounded-[18px] border border-kantioo-line px-4 py-3 outline-none" />
                    </div>
                    <input value={supplierForm.address} onChange={(event) => setSupplierForm((current) => ({ ...current, address: event.target.value }))} placeholder="Adresse" className="w-full rounded-[18px] border border-kantioo-line px-4 py-3 outline-none" />
                    <div className="grid gap-4 sm:grid-cols-3">
                      <input value={supplierForm.lat} onChange={(event) => setSupplierForm((current) => ({ ...current, lat: event.target.value }))} placeholder="Latitude" className="w-full rounded-[18px] border border-kantioo-line px-4 py-3 outline-none" />
                      <input value={supplierForm.lng} onChange={(event) => setSupplierForm((current) => ({ ...current, lng: event.target.value }))} placeholder="Longitude" className="w-full rounded-[18px] border border-kantioo-line px-4 py-3 outline-none" />
                      <input value={supplierForm.delivery_radius} onChange={(event) => setSupplierForm((current) => ({ ...current, delivery_radius: event.target.value }))} placeholder="Rayon livraison" className="w-full rounded-[18px] border border-kantioo-line px-4 py-3 outline-none" />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <input value={supplierForm.delivery_delay_hours} onChange={(event) => setSupplierForm((current) => ({ ...current, delivery_delay_hours: event.target.value }))} placeholder="Delai (heures)" className="w-full rounded-[18px] border border-kantioo-line px-4 py-3 outline-none" />
                      <select value={supplierForm.stock_availability} onChange={(event) => setSupplierForm((current) => ({ ...current, stock_availability: event.target.value as Supplier['stock_availability'] }))} className="w-full rounded-[18px] border border-kantioo-line px-4 py-3 outline-none"><option value="permanent">Stock permanent</option><option value="partial">Stock partiel</option><option value="on_demand">Sur commande</option></select>
                    </div>
                    <label className="flex items-center gap-3 rounded-[18px] border border-kantioo-line px-4 py-3 text-sm text-kantioo-dark">
                      <input type="checkbox" checked={supplierForm.is_active} onChange={(event) => setSupplierForm((current) => ({ ...current, is_active: event.target.checked }))} />
                      Fournisseur actif
                    </label>
                    <div className="flex gap-3">
                      <button type="submit" className="action-primary flex-1 justify-center gap-2"><Plus size={16} />Enregistrer</button>
                      {editingSupplierId ? <button type="button" onClick={resetSupplierForm} className="action-secondary">Annuler</button> : null}
                    </div>
                  </form>
                ) : null}

                {activeTab === 'materials' ? (
                  <form onSubmit={saveMaterial} className="space-y-4">
                    <h3 className="text-2xl font-black tracking-tight text-kantioo-dark">{editingMaterialId ? 'Modifier un article' : 'Ajouter un article'}</h3>
                    <input value={materialForm.name} onChange={(event) => setMaterialForm((current) => ({ ...current, name: event.target.value }))} placeholder="Nom de l'article" className="w-full rounded-[18px] border border-kantioo-line px-4 py-3 outline-none" />
                    
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-kantioo-dark">Catégorie</label>
                      <select 
                        value={materialForm.category} 
                        onChange={(event) => setMaterialForm((current) => ({ ...current, category: event.target.value }))} 
                        className="w-full rounded-[18px] border border-kantioo-line px-4 py-3 outline-none"
                      >
                        <option value="">Choisir une catégorie</option>
                        {uniqueCategories.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                        <option value="" disabled>─────────────────</option>
                        <option value="__new__">+ Ajouter une nouvelle catégorie</option>
                      </select>
                      
                      {materialForm.category === '__new__' && (
                        <input 
                          type="text"
                          placeholder="Nom de la nouvelle catégorie"
                          onChange={(event) => setMaterialForm((current) => ({ ...current, category: event.target.value }))}
                          className="w-full rounded-[18px] border border-kantioo-line px-4 py-3 outline-none bg-kantioo-sand"
                          autoFocus
                        />
                      )}
                      
                      {uniqueCategories.length > 0 && (
                        <p className="text-xs text-kantioo-muted">Catégories existantes: {uniqueCategories.join(', ')}</p>
                      )}
                    </div>
                    
                    <div className="grid gap-4 sm:grid-cols-2">
                      <input value={materialForm.unit} onChange={(event) => setMaterialForm((current) => ({ ...current, unit: event.target.value }))} placeholder="Unite" className="w-full rounded-[18px] border border-kantioo-line px-4 py-3 outline-none" />
                      <input value={materialForm.icon} onChange={(event) => setMaterialForm((current) => ({ ...current, icon: event.target.value }))} placeholder="Icone" className="w-full rounded-[18px] border border-kantioo-line px-4 py-3 outline-none" />
                    </div>
                    <div className="flex gap-3">
                      <button type="submit" className="action-primary flex-1 justify-center gap-2"><Plus size={16} />Enregistrer</button>
                      {editingMaterialId ? <button type="button" onClick={resetMaterialForm} className="action-secondary">Annuler</button> : null}
                    </div>
                  </form>
                ) : null}

                {activeTab === 'pricing' ? (
                  <div className="space-y-4">
                    {/* View Tabs */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPricingView('list');
                          setSelectedSupplierForEdit(null);
                          setEditablePrices({});
                        }}
                        className={`rounded-full px-4 py-2 text-sm font-semibold ${pricingView === 'list' ? 'bg-kantioo-dark text-white' : 'border border-kantioo-line bg-white text-kantioo-dark hover:bg-kantioo-sand'}`}
                      >
                        📋 Liste
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPricingView('by-supplier');
                          setEditablePrices({});
                        }}
                        className={`rounded-full px-4 py-2 text-sm font-semibold ${pricingView === 'by-supplier' ? 'bg-kantioo-dark text-white' : 'border border-kantioo-line bg-white text-kantioo-dark hover:bg-kantioo-sand'}`}
                      >
                        📊 Par fournisseur
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPricingView('comparison');
                          setEditablePrices({});
                        }}
                        className={`rounded-full px-4 py-2 text-sm font-semibold ${pricingView === 'comparison' ? 'bg-kantioo-dark text-white' : 'border border-kantioo-line bg-white text-kantioo-dark hover:bg-kantioo-sand'}`}
                      >
                        🔍 Comparaison
                      </button>
                    </div>

                    {/* Adjustment Controls - Only show in by-supplier view */}
                    {pricingView === 'by-supplier' && (
                      <div className="rounded-[18px] border border-kantioo-line p-4 bg-kantioo-sand space-y-3">
                        <p className="text-sm font-semibold text-kantioo-dark">Ajustement % en masse</p>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <select
                            value={adjustmentType}
                            onChange={(e) => setAdjustmentType(e.target.value as AdjustmentType)}
                            className="rounded-lg border border-kantioo-line px-3 py-2 text-sm"
                          >
                            <option value="increase">Augmenter (+)</option>
                            <option value="decrease">Réduire (-)</option>
                          </select>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              value={adjustmentPercent}
                              onChange={(e) => setAdjustmentPercent(e.target.value)}
                              min="1"
                              max="100"
                              className="flex-1 rounded-lg border border-kantioo-line px-3 py-2 text-sm"
                              placeholder="%"
                            />
                            <span className="flex items-center text-sm font-semibold">%</span>
                          </div>
                          <p className="text-xs text-kantioo-muted pt-2">Pré-remplissez le % puis cliquez sur le bouton d&apos;ajustement dans le tableau du fournisseur.</p>
                        </div>
                      </div>
                    )}

                    {/* Form for adding new price - Only show in list view */}
                    {pricingView === 'list' && (
                      <form onSubmit={savePrice} className="rounded-[18px] border border-kantioo-line p-4 space-y-4 bg-white">
                        <h3 className="text-2xl font-black tracking-tight text-kantioo-dark">{editingPriceId ? 'Modifier un tarif' : 'Ajouter un tarif'}</h3>
                        <select value={priceForm.supplier_id} onChange={(event) => setPriceForm((current) => ({ ...current, supplier_id: event.target.value }))} className="w-full rounded-[18px] border border-kantioo-line px-4 py-3 outline-none"><option value="">Choisir un fournisseur</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name} · {formatCityLabel(supplier.city)}</option>)}</select>
                        <select value={priceForm.material_id} onChange={(event) => setPriceForm((current) => ({ ...current, material_id: event.target.value }))} className="w-full rounded-[18px] border border-kantioo-line px-4 py-3 outline-none"><option value="">Choisir un article</option>{materials.map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}</select>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <input value={priceForm.price} onChange={(event) => setPriceForm((current) => ({ ...current, price: event.target.value }))} placeholder="Prix FCFA" className="w-full rounded-[18px] border border-kantioo-line px-4 py-3 outline-none" />
                          <input value={priceForm.unit} onChange={(event) => setPriceForm((current) => ({ ...current, unit: event.target.value }))} placeholder="Unite de vente" className="w-full rounded-[18px] border border-kantioo-line px-4 py-3 outline-none" />
                        </div>
                        <div className="flex gap-3">
                          <button type="submit" className="action-primary flex-1 justify-center gap-2"><Plus size={16} />Enregistrer</button>
                          {editingPriceId ? <button type="button" onClick={resetPriceForm} className="action-secondary">Annuler</button> : null}
                        </div>
                      </form>
                    )}
                  </div>
                ) : null}
              </section>

              <section className="space-y-4">
                {activeTab === 'suppliers' ? filteredSuppliers.map((supplier) => (
                  <div key={supplier.id} className="panel flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h3 className="text-2xl font-black tracking-tight text-kantioo-dark">{supplier.name}</h3>
                      <p className="mt-2 text-sm text-kantioo-muted">{formatCityLabel(supplier.city)}{supplier.quartier ? `, ${supplier.quartier}` : ''}</p>
                      <p className="mt-2 text-sm text-kantioo-dark">{supplier.phone}</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button type="button" onClick={() => { setEditingSupplierId(supplier.id); setSupplierForm({ name: supplier.name, phone: supplier.phone, contact_name: supplier.contact_name || '', email: supplier.email || '', city: formatCityLabel(supplier.city), quartier: supplier.quartier || '', address: supplier.address || '', lat: String(supplier.lat ?? ''), lng: String(supplier.lng ?? ''), delivery_radius: String(supplier.delivery_radius ?? 20), delivery_delay_hours: String(supplier.delivery_delay_hours || 24), stock_availability: supplier.stock_availability, is_active: supplier.is_active }); }} className="action-secondary gap-2"><Pencil size={16} />Modifier</button>
                      <button type="button" onClick={() => void removeRecord('suppliers', supplier.id)} className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"><Trash2 size={16} />Supprimer</button>
                    </div>
                  </div>
                )) : null}

                {activeTab === 'materials' ? filteredMaterials.map((material) => (
                  <div key={material.id} className="panel flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h3 className="text-2xl font-black tracking-tight text-kantioo-dark">{material.icon || '📦'} {material.name}</h3>
                      <p className="mt-2 text-sm text-kantioo-muted">{material.category} · {material.unit}</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button type="button" onClick={() => { setEditingMaterialId(material.id); setMaterialForm({ name: material.name, category: material.category, unit: material.unit, icon: material.icon || '' }); }} className="action-secondary gap-2"><Pencil size={16} />Modifier</button>
                      <button type="button" onClick={() => void removeRecord('materials', material.id)} className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"><Trash2 size={16} />Supprimer</button>
                    </div>
                  </div>
                )) : null}

                {activeTab === 'pricing' && pricingView === 'list' ? filteredPrices.map((price) => (
                  <div key={price.id} className="panel flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h3 className="text-2xl font-black tracking-tight text-kantioo-dark">{price.supplier?.name || 'Fournisseur'} · {price.material?.name || 'Article'}</h3>
                      <p className="mt-2 text-sm text-kantioo-muted">{(price.price || 0).toLocaleString('fr-FR')} FCFA / {price.unit}</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button type="button" onClick={() => { setEditingPriceId(price.id); setPriceForm({ supplier_id: price.supplier_id, material_id: price.material_id, price: String(price.price), unit: price.unit }); }} className="action-secondary gap-2"><Pencil size={16} />Modifier</button>
                      <button type="button" onClick={() => void removeRecord('supplier_materials', price.id)} className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"><Trash2 size={16} />Supprimer</button>
                    </div>
                  </div>
                )) : null}

                {activeTab === 'pricing' && pricingView === 'by-supplier' ? (
                  <div className="space-y-4">
                    {suppliers.filter((s) => s.is_active).map((supplier) => {
                      const supplierPrices = pricesBySupplier[supplier.id] || [];
                      if (supplierPrices.length === 0) return null;

                      return (
                        <div key={supplier.id} className="panel space-y-4 p-6">
                          <div className="flex flex-col gap-3 items-start lg:flex-row lg:items-center lg:justify-between">
                            <div>
                              <h3 className="text-2xl font-black tracking-tight text-kantioo-dark">{supplier.name}</h3>
                              <p className="mt-1 text-sm text-kantioo-muted">{formatCityLabel(supplier.city)}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button type="button" onClick={() => void applyPercentageAdjustment(supplier.id, Number.parseInt(adjustmentPercent, 10))} disabled={refreshing} className="inline-flex items-center gap-2 rounded-full bg-kantioo-orange px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"><TrendingUp size={16} />{adjustmentType === 'increase' ? '+' : '-'}{adjustmentPercent}%</button>
                              {Object.keys(editablePrices).length > 0 && <button type="button" onClick={() => void saveEditablePrices()} disabled={refreshing} className="action-primary gap-2"><Plus size={16} />Enregistrer modifications</button>}
                            </div>
                          </div>

                          <div className="overflow-x-auto -mx-6 px-6">
                            <table className="w-full text-left text-sm">
                              <thead className="border-b border-kantioo-line">
                                <tr>
                                  <th className="px-3 py-2 font-semibold text-kantioo-dark">Article</th>
                                  <th className="px-3 py-2 font-semibold text-kantioo-dark">Prix</th>
                                  <th className="px-3 py-2 font-semibold text-kantioo-dark">Unité</th>
                                  <th className="px-3 py-2 font-semibold text-kantioo-dark">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {supplierPrices.map((price) => (
                                  <tr key={price.id} className="border-b border-kantioo-sand">
                                    <td className="px-3 py-3 text-kantioo-dark font-semibold">{price.material?.name || 'Article'}</td>
                                    <td className="px-3 py-3">
                                      <input
                                        type="number"
                                        value={editablePrices[price.id] !== undefined ? editablePrices[price.id] : price.price}
                                        onChange={(e) => setEditablePrices((prev) => ({ ...prev, [price.id]: e.target.value }))}
                                        className="w-32 rounded-lg border border-kantioo-line px-2 py-1 text-sm"
                                      />
                                    </td>
                                    <td className="px-3 py-3 text-kantioo-muted">{price.unit}</td>
                                    <td className="px-3 py-3">
                                      <button type="button" onClick={() => void removeRecord('supplier_materials', price.id)} className="text-red-600 hover:text-red-800 text-xs font-semibold"><Trash2 size={14} /></button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {activeTab === 'pricing' && pricingView === 'comparison' ? (
                  <div className="space-y-4">
                    {materials.map((material) => {
                      const materialPrices = pricesByMaterial[material.id] || [];
                      if (materialPrices.length === 0) return null;

                      const avgPrice = materialPrices.reduce((sum, p) => sum + p.price, 0) / materialPrices.length;
                      const sorted = [...materialPrices].sort((a, b) => a.price - b.price);

                      return (
                        <div key={material.id} className="panel space-y-4 p-6">
                          <div>
                            <h3 className="text-2xl font-black tracking-tight text-kantioo-dark">{material.icon || '📦'} {material.name}</h3>
                            <p className="mt-1 text-sm text-kantioo-muted">{material.category} · Unité: {material.unit}</p>
                          </div>

                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="rounded-lg bg-kantioo-sand p-3">
                              <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-kantioo-muted">Moyenne</p>
                              <p className="mt-1 text-2xl font-black text-kantioo-dark">{Math.round(avgPrice).toLocaleString('fr-FR')} FCFA</p>
                            </div>
                            <div className="rounded-lg bg-green-50 p-3">
                              <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-green-700">Min ({sorted[0].supplier?.name})</p>
                              <p className="mt-1 text-2xl font-black text-green-700">{sorted[0].price.toLocaleString('fr-FR')} FCFA</p>
                            </div>
                            <div className="rounded-lg bg-red-50 p-3">
                              <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-red-700">Max ({sorted[sorted.length - 1].supplier?.name})</p>
                              <p className="mt-1 text-2xl font-black text-red-700">{sorted[sorted.length - 1].price.toLocaleString('fr-FR')} FCFA</p>
                            </div>
                            <div className="rounded-lg bg-blue-50 p-3">
                              <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-blue-700">Écart</p>
                              <p className="mt-1 text-2xl font-black text-blue-700">{Math.round(((sorted[sorted.length - 1].price - sorted[0].price) / sorted[0].price) * 100)}%</p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            {sorted.map((price, idx) => {
                              const variance = ((price.price - avgPrice) / avgPrice) * 100;
                              return (
                                <div key={price.id} className="flex items-center gap-3 rounded-lg border border-kantioo-line p-3">
                                  <div className="flex-1">
                                    <p className="font-semibold text-kantioo-dark">{idx + 1}. {price.supplier?.name}</p>
                                    <p className="text-sm text-kantioo-muted">{price.unit} · {(price.price || 0).toLocaleString('fr-FR')} FCFA</p>
                                  </div>
                                  <div className={`rounded-full px-3 py-1 text-sm font-semibold ${variance < -5 ? 'bg-green-100 text-green-700' : variance > 5 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {variance > 0 ? '+' : ''}{variance.toFixed(1)}%
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
