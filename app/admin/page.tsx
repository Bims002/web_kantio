import AdminWorkspace from '@/components/admin/AdminWorkspace';
import AdminLogin from '@/components/admin/AdminLogin';
import { getAdminEmail, getAdminSession } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await getAdminSession();

  if (!session) {
    return <AdminLogin defaultEmail={getAdminEmail()} />;
  }

  return <AdminWorkspace adminEmail={session.email} />;
}
/*

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { buildWhatsAppLink, generateWhatsAppMessage } from '@/lib/whatsapp';
import { 
  ShoppingBag, 
  Users, 
  MessageSquare, 
  CheckCircle, 
  Clock, 
  Truck, 
  XCircle,
  Upload,
  RefreshCw,
  LogOut,
  ChevronRight
} from 'lucide-react';
import Papa from 'papaparse';

export default function AdminDashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'orders' | 'suppliers'>('orders');
  const [loading, setLoading] = useState(true);
  
  // Catalog editing states
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [supplierMaterials, setSupplierMaterials] = useState<any[]>([]);
  const [savingPrice, setSavingPrice] = useState<string | null>(null);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false });
    if (data) setOrders(data);
  };

  const fetchSuppliers = async () => {
    const { data } = await supabase
      .from('suppliers')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setSuppliers(data);
  };

  const fetchSupplierMaterials = async (supplier: any) => {
    setEditingSupplier(supplier);
    const { data } = await supabase
      .from('supplier_materials')
      .select('*, material:materials(*)')
      .eq('supplier_id', supplier.id);
    if (data) setSupplierMaterials(data);
  };

  const updateMaterialPrice = async (materialId: string, newPrice: number) => {
    setSavingPrice(materialId);
    const { error } = await supabase
      .from('supplier_materials')
      .update({ price: newPrice })
      .eq('id', materialId);
    
    if (!error) {
      setSupplierMaterials(prev => prev.map(m => m.id === materialId ? { ...m, price: newPrice } : m));
    }
    setSavingPrice(null);
  };

  const updateMaterialUnit = async (materialId: string, newUnit: string) => {
    const { error } = await supabase
      .from('supplier_materials')
      .update({ unit: newUnit })
      .eq('id', materialId);
    
    if (!error) {
      setSupplierMaterials(prev => prev.map(m => m.id === materialId ? { ...m, unit: newUnit } : m));
    }
  };

  const updateSupplierStock = async (supplierId: string, availability: string) => {
    const { error } = await supabase
      .from('suppliers')
      .update({ stock_availability: availability })
      .eq('id', supplierId);
    
    if (!error) {
      setEditingSupplier({ ...editingSupplier, stock_availability: availability });
      fetchSuppliers(); // Refresh main list
    }
  };

  useEffect(() => {
    Promise.all([fetchOrders(), fetchSuppliers()]).then(() => setLoading(false));
  }, []);

  const totalRevenue = orders.reduce((sum, o) => sum + (o.total_price || 0), 0);
  const activeOrders = orders.filter(o => ['pending', 'confirmed', 'in_delivery'].includes(o.status)).length;
  
  const supplierStats = orders.reduce((acc: any, o) => {
    if (!o.supplier_id) return acc;
    acc[o.supplier_id] = (acc[o.supplier_id] || 0) + 1;
    return acc;
  }, {});

  const topSupplierId = Object.entries(supplierStats).sort((a: any, b: any) => b[1] - a[1])[0]?.[0];
  const topSupplier = suppliers.find(s => s.id === topSupplierId);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', orderId);
    
    if (!error) fetchOrders();
  };

  const toggleSupplierActive = async (supplierId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('suppliers')
      .update({ is_active: !currentStatus })
      .eq('id', supplierId);
    
    if (!error) fetchSuppliers();
  };

  const statusColors: any = {
    pending: 'bg-kantioo-dark text-white border-kantioo-dark',
    confirmed: 'bg-blue-600 text-white border-blue-600',
    in_delivery: 'bg-purple-600 text-white border-purple-600',
    delivered: 'bg-kantioo-green text-white border-kantioo-green',
    cancelled: 'bg-red-600 text-white border-red-600',
  };

  const handleCsvImport = (e: any) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        console.log('Données CSV reçues:', results.data);
        const cleanedData = results.data
          .map((row: any) => {
            // Normaliser les clés (minuscules, sans espaces)
            const normalizedRow: any = {};
            Object.keys(row).forEach(key => {
              normalizedRow[key.toLowerCase().trim()] = row[key];
            });

            const name = normalizedRow.name || normalizedRow.nom || normalizedRow.fournisseur || normalizedRow.supplier;
            const phone = normalizedRow.phone || normalizedRow.tel || normalizedRow.téléphone || normalizedRow.phone_number || normalizedRow.mobile;
            
            return {
              name,
              phone,
              city: normalizedRow.city || normalizedRow.ville || 'Douala',
              quartier: normalizedRow.quartier || normalizedRow.zone || '',
              lat: parseFloat(normalizedRow.lat || normalizedRow.latitude) || 0,
              lng: parseFloat(normalizedRow.lng || normalizedRow.longitude) || 0,
              is_active: false
            };
          })
          .filter((row: any) => row.name && row.phone); // S'assurer que les champs obligatoires existent
        
        if (cleanedData.length === 0) {
          console.log('Données malformées ou colonnes non reconnues. Reçu:', results.data[0]);
          alert('Aucune donnée valide trouvée. Assurez-vous d\'avoir des colonnes nommées "name" (ou "nom") et "phone" (ou "tel").');
          return;
        }

        const { error } = await supabase.from('suppliers').insert(cleanedData);
        if (!error) {
          alert('Fournisseurs importés avec succès !');
          fetchSuppliers();
        } else {
          console.error('Erreur Supabase lors de l\'import CSV:', error);
          alert(`Erreur lors de l'importation : ${error.message}`);
        }
      }
    });
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-xl font-black text-kantioo-dark uppercase tracking-widest">Chargement...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white flex">
      {/* Sidebar Navigation * /}
      <aside className="w-80 bg-white border-r-2 border-gray-200 p-10 flex flex-col pt-16">
        <h2 className="text-3xl font-black mb-16 tracking-tighter text-kantioo-dark">KANTIOO <span className="text-kantioo-orange">ADMIN</span></h2>
        
        <nav className="space-y-4 flex-1">
          <button 
            onClick={() => setActiveTab('orders')}
            className={`w-full flex items-center space-x-4 px-6 py-4 rounded-2xl border-2 font-black text-sm uppercase tracking-widest ${activeTab === 'orders' ? 'bg-kantioo-dark text-white border-kantioo-dark' : 'text-kantioo-dark/40 border-transparent'}`}
          >
            <ShoppingBag size={20} />
            <span>Commandes</span>
          </button>
          <button 
            onClick={() => setActiveTab('suppliers')}
            className={`w-full flex items-center space-x-4 px-6 py-4 rounded-2xl border-2 font-black text-sm uppercase tracking-widest ${activeTab === 'suppliers' ? 'bg-kantioo-dark text-white border-kantioo-dark' : 'text-kantioo-dark/40 border-transparent'}`}
          >
            <Users size={20} />
            <span>Fournisseurs</span>
          </button>
        </nav>

        <button className="flex items-center space-x-4 text-kantioo-dark/30 px-6 py-4 font-black text-xs uppercase tracking-widest">
          <LogOut size={20} />
          <span>Déconnexion</span>
        </button>
      </aside>

      {/* Main Content * /}
      <main className="flex-1 p-16 overflow-y-auto h-screen">
        <header className="flex justify-between items-center mb-16">
          <div>
            <h1 className="text-5xl font-black text-kantioo-dark mb-3 tracking-tighter">
              {activeTab === 'orders' ? 'Commandes' : 'Fournisseurs'}
            </h1>
            <div className="flex items-center space-x-4">
              <p className="text-kantioo-dark/60 font-black uppercase tracking-widest text-[10px]">Interface de contrôle MVP</p>
              <button 
                onClick={() => Promise.all([fetchOrders(), fetchSuppliers()])}
                className="p-2 text-kantioo-orange bg-white border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors"
                title="Actualiser"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>
          
          {activeTab === 'suppliers' && (
            <div className="relative">
              <input 
                type="file" 
                accept=".csv" 
                onChange={handleCsvImport}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <button className="bg-white border-2 border-gray-200 flex items-center space-x-3 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest">
                <Upload size={18} />
                <span>Importer CSV</span>
              </button>
            </div>
          )}
        </header>

        {activeTab === 'orders' ? (
          <div className="space-y-12">
            {/* Stats Widgets * /}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white p-8 rounded-[32px] border-2 border-gray-200">
                <p className="text-[10px] font-black text-kantioo-dark/40 uppercase tracking-widest mb-2">Chiffre d'Affaires</p>
                <p className="text-3xl font-black text-kantioo-dark">{totalRevenue.toLocaleString()} <span className="text-xs text-kantioo-dark/20 uppercase">FCFA</span></p>
              </div>
              <div className="bg-white p-8 rounded-[32px] border-2 border-gray-200">
                <label className="text-xs font-black text-kantioo-dark/60 uppercase tracking-widest pl-1">Commandes Actives</label>
                <div className="flex items-baseline space-x-2">
                  <p className="text-3xl font-black text-kantioo-dark">{activeOrders}</p>
                  <p className="text-[10px] font-black text-kantioo-green uppercase tracking-widest">Sur {orders.length}</p>
                </div>
              </div>
              <div className="bg-white p-8 rounded-[32px] border-2 border-gray-200">
                <label className="text-xs font-black text-kantioo-dark/60 uppercase tracking-widest pl-1">Top Fournisseur</label>
                <p className="text-xl font-black text-kantioo-orange truncate">{topSupplier?.name || '--'}</p>
              </div>
            </div>

            <div className="grid gap-8">
            {orders.map((o) => (
              <div key={o.id} className="bg-white p-10 rounded-[40px] border-2 border-gray-200 flex flex-col xl:flex-row xl:items-center gap-10">
                <div className="flex-1">
                  <div className="flex items-center space-x-4 mb-6">
                    <span className="text-[10px] font-black text-kantioo-dark uppercase tracking-widest bg-gray-200 px-3 py-1 rounded-lg">#{o.tracking_token}</span>
                    <span className={`text-[10px] font-black px-4 py-1 rounded-full border-2 uppercase tracking-widest ${statusColors[o.status]}`}>
                      {o.status}
                    </span>
                  </div>
                  <h3 className="text-2xl font-black text-kantioo-dark mb-2 tracking-tight">{o.site_name}</h3>
                  <p className="text-sm font-black text-kantioo-dark/40 mb-8 border-l-2 border-gray-200 pl-4">{o.site_address}</p>
                  
                  <div className="grid grid-cols-2 gap-8 text-xs font-black">
                    <div>
                      <p className="text-kantioo-dark/20 uppercase font-black tracking-widest mb-2 text-[9px]">Client</p>
                      <p className="font-black text-kantioo-dark text-sm">{o.contact_name}</p>
                      <p className="font-black text-kantioo-dark/40">{o.contact_phone}</p>
                    </div>
                    <div>
                      <p className="text-kantioo-dark/20 uppercase font-black tracking-widest mb-2 text-[9px]">Fournisseur</p>
                      <p className="font-black text-kantioo-orange text-sm">{o.supplier_name}</p>
                    </div>
                  </div>
                </div>

                <div className="xl:w-64 bg-white p-8 rounded-3xl border-2 border-gray-200 text-center">
                  <p className="text-[10px] text-kantioo-dark/40 font-black uppercase tracking-widest mb-2">Montant Total</p>
                  <p className="text-3xl font-black text-kantioo-dark">{o.total_price?.toLocaleString()} <span className="text-xs uppercase text-kantioo-dark/20 ml-1">FCFA</span></p>
                </div>

                <div className="flex flex-col gap-4">
                   <a 
                     href={buildWhatsAppLink(generateWhatsAppMessage(o))}
                     target="_blank"
                     className="bg-kantioo-green text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center border-2 border-kantioo-green"
                   >
                     <MessageSquare size={18} className="mr-3" /> WhatsApp
                   </a>
                   
                   <div className="flex gap-2">
                     <button 
                       onClick={() => updateOrderStatus(o.id, 'confirmed')}
                       className="p-4 bg-white border-2 border-kantioo-dark/10 rounded-2xl text-kantioo-dark hover:border-kantioo-orange transition-colors" title="Confirmer"
                     >
                       <CheckCircle size={20} />
                     </button>
                     <button 
                       onClick={() => updateOrderStatus(o.id, 'in_delivery')}
                       className="p-4 bg-white border-2 border-kantioo-dark/10 rounded-2xl text-kantioo-dark hover:border-kantioo-orange transition-colors" title="Livrer"
                     >
                       <Truck size={20} />
                     </button>
                     <button 
                       onClick={() => updateOrderStatus(o.id, 'delivered')}
                       className="p-4 bg-kantioo-dark border-2 border-kantioo-dark rounded-2xl text-white" title="Livré"
                     >
                       <CheckCircle size={20} />
                     </button>
                     <button 
                       onClick={() => updateOrderStatus(o.id, 'cancelled')}
                       className="p-4 bg-white border-2 border-kantioo-dark/10 rounded-2xl text-red-600 hover:bg-red-50 transition-colors" title="Annuler"
                     >
                       <XCircle size={20} />
                     </button>
                   </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {suppliers.map((s) => (
              <div key={s.id} className="bg-white p-10 rounded-[40px] border-2 border-gray-200 flex items-center justify-between">
                <div className="flex items-center space-x-8">
                  <div className={`w-20 h-20 rounded-3xl flex items-center justify-center text-3xl font-black border-2 ${s.is_active ? 'bg-kantioo-dark text-white border-kantioo-dark' : 'bg-white text-kantioo-dark/20 border-gray-200'}`}>
                    {s.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-kantioo-dark mb-2 tracking-tight">{s.name}</h3>
                    <p className="text-[10px] text-kantioo-orange font-black uppercase tracking-widest">{s.city} • {s.quartier}</p>
                    <p className="text-sm font-black text-kantioo-dark/40 mt-4">{s.phone}</p>
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-3">
                  <button 
                    onClick={() => toggleSupplierActive(s.id, s.is_active)}
                    className={`px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest border-2 ${
                      s.is_active ? 'bg-kantioo-green text-white border-kantioo-green' : 'bg-white text-kantioo-dark/20 border-gray-200'
                    }`}
                  >
                    {s.is_active ? 'Actif' : 'Désactivé'}
                  </button>
                  <button 
                    onClick={() => fetchSupplierMaterials(s)}
                    className="px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest border-2 border-kantioo-dark bg-white text-kantioo-dark flex items-center space-x-2"
                  >
                    <RefreshCw size={14} className={editingSupplier?.id === s.id ? 'animate-spin' : ''} />
                    <span>Catalogue</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Catalog Editor Overlay * /}
        {editingSupplier && (
          <div className="fixed inset-0 bg-kantioo-dark/80 backdrop-blur-sm z-50 flex items-center justify-center p-8">
            <div className="bg-white w-full max-w-2xl rounded-[40px] border-4 border-kantioo-dark overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-10 border-b-2 border-gray-100 flex justify-between items-center bg-gray-50">
                <div>
                  <h2 className="text-3xl font-black text-kantioo-dark tracking-tighter">Catalogue : {editingSupplier.name}</h2>
                  <div className="flex items-center space-x-4 mt-2">
                    <p className="text-[10px] text-kantioo-orange font-black uppercase tracking-widest">Disponibilité :</p>
                    <select 
                      value={editingSupplier.stock_availability}
                      onChange={(e) => updateSupplierStock(editingSupplier.id, e.target.value)}
                      className="bg-white border-2 border-gray-200 rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-widest outline-none focus:border-kantioo-orange"
                    >
                      <option value="permanent">Stock Permanent</option>
                      <option value="partial">Stock Partiel</option>
                      <option value="on_demand">Sur Commande</option>
                    </select>
                  </div>
                </div>
                <button 
                  onClick={() => setEditingSupplier(null)}
                  className="w-12 h-12 rounded-2xl bg-white border-2 border-gray-200 flex items-center justify-center text-kantioo-dark"
                >
                  <XCircle size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-6">
                {supplierMaterials.length > 0 ? (
                  supplierMaterials.map((sm) => (
                    <div key={sm.id} className="flex items-center justify-between p-6 rounded-3xl border-2 border-gray-100 bg-white">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-xl bg-kantioo-sand flex items-center justify-center text-xl">
                          {sm.material?.icon || '📦'}
                        </div>
                        <div>
                          <p className="font-black text-kantioo-dark">{sm.material?.name}</p>
                          <input 
                            type="text" 
                            defaultValue={sm.unit}
                            onBlur={(e) => updateMaterialUnit(sm.id, e.target.value)}
                            className="text-[10px] text-kantioo-dark font-black uppercase tracking-widest bg-white border-2 border-gray-100 rounded-lg px-2 py-1 focus:border-kantioo-orange outline-none"
                          />
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <div className="relative">
                          <input 
                            type="number" 
                            defaultValue={sm.price}
                            onBlur={(e) => updateMaterialPrice(sm.id, parseInt(e.target.value))}
                            className="w-32 bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-2 font-black text-right outline-none focus:border-kantioo-orange transition-colors"
                          />
                          <span className="absolute -top-6 right-0 text-[9px] font-black text-kantioo-dark/30 uppercase tracking-widest">Prix (FCFA)</span>
                        </div>
                        {savingPrice === sm.id && (
                          <RefreshCw size={16} className="animate-spin text-kantioo-orange" />
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-20">
                    <p className="font-black text-kantioo-dark/20 uppercase tracking-widest">Aucun matériau configuré</p>
                  </div>
                )}
              </div>
              
              <div className="p-10 bg-gray-50 border-t-2 border-gray-100 italic text-[11px] text-kantioo-dark/40 font-bold">
                * Les prix sont mis à jour automatiquement dès que vous quittez le champ de saisie.
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
*/
