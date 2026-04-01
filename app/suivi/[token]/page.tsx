import { supabase } from "@/lib/supabase";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import type { Order } from "@/lib/types";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import {
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  MessageSquare,
  Package,
  Truck,
  User,
} from "lucide-react";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function TrackingPage({ params }: PageProps) {
  noStore();

  const { token } = await params;

  const { data: order, error } = await supabase
    .from("orders")
    .select(
      `
      *,
      order_items (*)
    `
    )
    .eq("tracking_token", token)
    .single();

  if (error || !order) {
    return notFound();
  }

  const currentOrder = order as Order;

  const statusSteps = [
    { key: "pending", label: "Commande recue", icon: Clock },
    { key: "confirmed", label: "Confirmee", icon: Package },
    { key: "in_delivery", label: "En livraison", icon: Truck },
    { key: "delivered", label: "Livree", icon: CheckCircle2 },
  ];

  const currentStepIndex = statusSteps.findIndex((step) => step.key === order.status);

  return (
    <div className="shell py-10 sm:py-14">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="panel overflow-hidden px-6 py-8 sm:px-8 sm:py-10">
          <span className="eyebrow">Suivi commande</span>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="display text-5xl font-bold tracking-[-0.06em] text-kantioo-dark sm:text-6xl">
                {order.tracking_token}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-kantioo-muted">
                Conservez ce code pour partager le statut de la commande avec votre equipe chantier.
              </p>
            </div>
            <div className="rounded-full bg-kantioo-sand px-5 py-3 text-sm font-semibold text-kantioo-dark">
              {statusSteps[currentStepIndex]?.label || order.status}
            </div>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {statusSteps.map((step, index) => {
              const Icon = step.icon;
              const active = index <= currentStepIndex;

              return (
                <div
                  key={step.key}
                  className={`rounded-[26px] px-4 py-5 ${
                    active
                      ? "bg-kantioo-dark text-white"
                      : "bg-white text-kantioo-muted ring-1 ring-kantioo-line"
                  }`}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/12">
                    <Icon size={18} />
                  </div>
                  <p className="mt-4 text-[0.68rem] font-semibold uppercase tracking-[0.22em] opacity-70">
                    Etape {index + 1}
                  </p>
                  <p className="display mt-2 text-xl font-bold tracking-[-0.04em]">
                    {step.label}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="panel p-6">
          <p className="eyebrow">Besoin de support</p>
          <a
            href={buildWhatsAppLink(
              `Bonjour, je souhaite des informations sur ma commande #${order.tracking_token}`
            )}
            target="_blank"
            className="action-primary mt-4 flex w-full gap-2"
          >
            <MessageSquare size={16} />
            Contacter le support
          </a>
        </aside>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-6">
          <div className="panel px-6 py-7 sm:px-8">
            <h2 className="display text-3xl font-bold tracking-[-0.05em] text-kantioo-dark">
              Details de la commande
            </h2>
            <div className="mt-6 space-y-4">
              {currentOrder.order_items?.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-4 rounded-[24px] bg-white px-4 py-4 ring-1 ring-kantioo-line"
                >
                  <div>
                    <p className="text-base font-semibold text-kantioo-dark">{item.material_name}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-kantioo-muted">
                      {item.quantity} x {item.unit}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-kantioo-dark">
                    Disponible
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between rounded-[24px] bg-kantioo-sand px-5 py-4">
              <span className="display text-2xl font-bold tracking-[-0.04em] text-kantioo-dark">
                Total
              </span>
              <span className="text-lg font-semibold text-kantioo-dark">
                —
              </span>
            </div>
          </div>

          <div className="panel px-6 py-7 sm:px-8">
            <h2 className="display text-3xl font-bold tracking-[-0.05em] text-kantioo-dark">
              Livraison chantier
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] bg-kantioo-sand px-5 py-5">
                <p className="flex items-center gap-2 text-sm font-semibold text-kantioo-dark">
                  <MapPin size={16} className="text-kantioo-orange" />
                  Site
                </p>
                <p className="mt-3 text-sm leading-7 text-kantioo-muted">{order.site_name}</p>
                <p className="mt-2 text-sm leading-7 text-kantioo-muted">{order.site_address}</p>
              </div>

              <div className="space-y-4">
                <div className="rounded-[24px] bg-white px-5 py-5 ring-1 ring-kantioo-line">
                  <p className="flex items-center gap-2 text-sm font-semibold text-kantioo-dark">
                    <User size={16} className="text-kantioo-orange" />
                    Contact
                  </p>
                  <p className="mt-3 text-sm leading-7 text-kantioo-muted">{order.contact_name}</p>
                </div>
                <div className="rounded-[24px] bg-white px-5 py-5 ring-1 ring-kantioo-line">
                  <p className="flex items-center gap-2 text-sm font-semibold text-kantioo-dark">
                    <Calendar size={16} className="text-kantioo-orange" />
                    Creation
                  </p>
                  <p className="mt-3 text-sm leading-7 text-kantioo-muted">
                    {new Date(order.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="panel p-6">
            <p className="eyebrow">Statut</p>
            <div className="mt-4 space-y-4">
              <div className="rounded-[24px] bg-kantioo-sand px-4 py-4 text-sm text-kantioo-dark">
                Fournisseur: {order.supplier_name || "A confirmer"}
              </div>
              <div className="rounded-[24px] bg-white px-4 py-4 text-sm text-kantioo-dark ring-1 ring-kantioo-line">
                Mise a jour: {statusSteps[currentStepIndex]?.label || order.status}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
