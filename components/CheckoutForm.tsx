'use client';

import { useState } from 'react';
import { formatCityLabel } from '@/lib/cities';
import { createOrderDraft, type OrderDraft } from '@/lib/order-assistant';
import type { Supplier } from '@/lib/types';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  MapPin,
  MessageSquare,
  PackageSearch,
  Plus,
  ShieldCheck,
  Trash2,
  Truck,
} from 'lucide-react';

interface SupplierMaterialEntry {
  id: string;
  material_id: string;
  price: number;
  unit: string;
  material?: {
    name: string;
  };
}

interface SupplierWithMaterials extends Supplier {
  supplier_materials: SupplierMaterialEntry[];
}

interface Props {
  initialSupplier?: SupplierWithMaterials;
  allSuppliers: SupplierWithMaterials[];
  initialMaterialId?: string | null;
}

export default function CheckoutForm({
  initialSupplier,
  allSuppliers,
  initialMaterialId,
}: Props) {
  const router = useRouter();
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierWithMaterials | undefined>(
    initialSupplier
  );
  const [cart, setCart] = useState<{ materialId: string; quantity: number }[]>(
    initialMaterialId ? [{ materialId: initialMaterialId, quantity: 1 }] : []
  );
  const [siteInfo, setSiteInfo] = useState({
    name: '',
    address: '',
    city: initialSupplier?.city || 'Douala',
  });
  const [contactInfo] = useState({
    name: '',
    phone: '',
    notes: '',
  });
  const [errorMessage, setErrorMessage] = useState('');

  const totalAmount = cart.reduce((total, item) => {
    const matchedMaterial = selectedSupplier?.supplier_materials.find(
      (material) => material.material_id === item.materialId
    );

    return total + (matchedMaterial?.price || 0) * item.quantity;
  }, 0);

  const canHandOffToAssistant = Boolean(selectedSupplier) && cart.length > 0;

  const steps = [{ id: 1, title: 'Panier', icon: PackageSearch }];

  const handleRedirectToAssistant = () => {
    if (!selectedSupplier || !canHandOffToAssistant) {
      return;
    }

    setErrorMessage('');

    try {
      const draft: OrderDraft = createOrderDraft({
        selectedSupplier,
        cart,
        siteInfo,
        contactInfo,
        totalAmount,
      });

      sessionStorage.setItem('kantioo-order-draft', JSON.stringify(draft));
      router.push('/assistant-commande');
    } catch (error) {
      console.error('Assistant handoff error', error);
      setErrorMessage("Impossible d'ouvrir l'assistant de commande pour le moment.");
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <div className="panel px-6 py-6 sm:px-8">
          <div className="flex flex-wrap gap-3">
            {steps.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.id}
                  className="flex flex-1 items-center gap-3 rounded-[22px] bg-kantioo-dark px-4 py-3 text-white"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/14">
                    <Icon size={18} />
                  </div>
                  <div>
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] opacity-70">
                      Etape {item.id}
                    </p>
                    <p className="display text-xl font-bold tracking-[-0.04em]">{item.title}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel px-6 py-8 sm:px-8">
          <h2 className="display text-3xl font-bold tracking-[-0.05em] text-kantioo-dark">
            Choisissez le fournisseur puis construisez le panier.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-kantioo-muted">
            Les informations de livraison et de contact ne sont plus saisies ici. Une fois le
            panier pret, l assistant de commande vous les demandera directement dans la
            conversation.
          </p>

          <div className="mt-6">
            <label className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-kantioo-muted">
              Fournisseur
            </label>
            <select
              className="mt-2 w-full rounded-[22px] border border-kantioo-line bg-white px-4 py-4 text-sm font-semibold text-kantioo-dark outline-none"
              value={selectedSupplier?.id || ''}
              onChange={(event) => {
                const nextSupplier = allSuppliers.find(
                  (supplier) => supplier.id === event.target.value
                );
                setSelectedSupplier(nextSupplier);
                setCart([]);
                setSiteInfo((current) => ({
                  ...current,
                  city: nextSupplier?.city || current.city,
                }));
              }}
            >
              <option value="">Selectionnez un fournisseur</option>
              {allSuppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name} ({formatCityLabel(supplier.city)})
                </option>
              ))}
            </select>
          </div>

          {selectedSupplier ? (
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {selectedSupplier.supplier_materials.map((item) => {
                const inCart = cart.find((entry) => entry.materialId === item.material_id);

                return (
                  <div key={item.id} className="rounded-[26px] border border-kantioo-line bg-white p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="display text-2xl font-bold tracking-[-0.04em] text-kantioo-dark">
                          {item.material?.name}
                        </p>
                        <p className="mt-2 text-sm text-kantioo-muted">{item.unit}</p>
                      </div>
                      <p className="text-right text-sm font-semibold text-kantioo-dark">
                        {item.price.toLocaleString('fr-FR')} FCFA
                      </p>
                    </div>

                    {inCart ? (
                      <div className="mt-5 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setCart((current) =>
                              current.map((entry) =>
                                entry.materialId === item.material_id
                                  ? { ...entry, quantity: Math.max(1, entry.quantity - 1) }
                                  : entry
                              )
                            )
                          }
                          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-kantioo-dark text-white"
                        >
                          -
                        </button>
                        <span className="min-w-6 text-center text-lg font-semibold text-kantioo-dark">
                          {inCart.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setCart((current) =>
                              current.map((entry) =>
                                entry.materialId === item.material_id
                                  ? { ...entry, quantity: entry.quantity + 1 }
                                  : entry
                              )
                            )
                          }
                          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-kantioo-dark text-white"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setCart((current) =>
                              current.filter((entry) => entry.materialId !== item.material_id)
                            )
                          }
                          className="ml-auto flex h-10 w-10 items-center justify-center rounded-2xl border border-kantioo-line text-kantioo-muted"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setCart((current) => [
                            ...current,
                            { materialId: item.material_id, quantity: 1 },
                          ])
                        }
                        className="action-primary mt-5 flex w-full gap-2"
                      >
                        <Plus size={16} />
                        Ajouter au panier
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-8 rounded-[26px] border border-dashed border-kantioo-line px-6 py-8 text-center">
              <p className="text-sm leading-6 text-kantioo-muted">
                Commencez par choisir un fournisseur pour afficher son catalogue.
              </p>
            </div>
          )}
        </div>

        <div className="panel flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm leading-6 text-kantioo-muted">
            Le fournisseur reste masque cote contact. L assistant Kantioo prend le relais pour la
            suite.
          </div>
          <button
            type="button"
            disabled={!canHandOffToAssistant}
            onClick={handleRedirectToAssistant}
            className="action-primary gap-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continuer avec l assistant
            <ArrowRight size={16} />
          </button>
        </div>

        {errorMessage ? (
          <div className="rounded-[22px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}
      </div>

      <aside className="space-y-6">
        <div className="panel sticky top-28 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow">Recapitulatif</p>
              <h2 className="display mt-2 text-3xl font-bold tracking-[-0.05em] text-kantioo-dark">
                Votre panier
              </h2>
            </div>
            <div className="rounded-[20px] bg-kantioo-sand px-4 py-3 text-right">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-kantioo-muted">
                Total
              </p>
              <p className="mt-1 text-lg font-semibold text-kantioo-dark">
                {totalAmount.toLocaleString('fr-FR')} FCFA
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {cart.length > 0 ? (
              cart.map((item) => {
                const matchedMaterial = selectedSupplier?.supplier_materials.find(
                  (material) => material.material_id === item.materialId
                );

                return (
                  <div
                    key={item.materialId}
                    className="rounded-[22px] bg-white px-4 py-4 ring-1 ring-kantioo-line"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-kantioo-dark">
                          {matchedMaterial?.material?.name || 'Materiau'}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-kantioo-muted">
                          {item.quantity} x {matchedMaterial?.unit || 'unite'}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-kantioo-dark">
                        {((matchedMaterial?.price || 0) * item.quantity).toLocaleString('fr-FR')} FCFA
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-[22px] border border-dashed border-kantioo-line px-4 py-5 text-sm text-kantioo-muted">
                Votre panier est vide.
              </div>
            )}
          </div>

          <div className="mt-6 space-y-3 rounded-[24px] bg-kantioo-sand p-4 text-sm text-kantioo-dark">
            <div className="flex items-center gap-3">
              <Truck size={16} className="text-kantioo-orange" />
              {selectedSupplier?.name || 'Aucun fournisseur selectionne'}
            </div>
            <div className="flex items-center gap-3">
              <MapPin size={16} className="text-kantioo-orange" />
              {formatCityLabel(siteInfo.city)}
            </div>
            <div className="flex items-center gap-3">
              <MessageSquare size={16} className="text-kantioo-orange" />
              Assistant IA dedie a la commande
            </div>
          </div>
        </div>

        <div className="panel p-6">
          <div className="flex items-center gap-3 text-sm font-medium text-kantioo-dark">
            <ShieldCheck size={18} className="text-kantioo-orange" />
            Paiement a la livraison possible
          </div>
        </div>
      </aside>
    </div>
  );
}
