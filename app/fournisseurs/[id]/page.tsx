import { formatCityLabel } from "@/lib/cities";
import { supabase } from "@/lib/supabase";
import { Supplier } from "@/lib/types";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  MapPin,
  ShieldCheck,
  Star,
  Truck,
} from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface SupplierMaterialEntry {
  id: string;
  material_id: string;
  // price removed
  unit: string;
  material?: {
    name: string;
    icon: string | null;
  };
}

export default async function SupplierProfile({ params }: PageProps) {
  const { id } = await params;

  const { data: supplier, error } = await supabase
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
    .eq("id", id)
    .single();

  if (error || !supplier) {
    return notFound();
  }

  const s = supplier as Supplier & { supplier_materials: SupplierMaterialEntry[] };
  const topMaterials = s.supplier_materials.slice(0, 3);

  return (
    <div className="shell py-10 sm:py-14">
      <Link href="/fournisseurs" className="action-secondary mb-6 inline-flex gap-2">
        <ArrowLeft size={16} />
        Retour aux fournisseurs
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_360px]">
        <section className="panel overflow-hidden px-6 py-8 sm:px-8 sm:py-10">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-kantioo-sand px-4 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-kantioo-orange">
              Fournisseur verifie
            </span>
            <span className="rounded-full border border-kantioo-line bg-white px-4 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-kantioo-dark">
              Stock {s.stock_availability}
            </span>
          </div>

          <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="display text-5xl font-bold tracking-[-0.06em] text-kantioo-dark sm:text-6xl">
                {s.name}
              </h1>
              <div className="mt-4 flex flex-wrap items-center gap-5 text-sm text-kantioo-muted">
                <span className="flex items-center gap-2">
                  <MapPin size={16} className="text-kantioo-orange" />
                  {s.quartier ? `${s.quartier}, ` : ""}
                  {formatCityLabel(s.city)}
                </span>
                <span className="flex items-center gap-2">
                  <Star size={16} className="fill-kantioo-orange text-kantioo-orange" />
                  4.8 satisfaction chantier
                </span>
              </div>
            </div>

            <div className="panel-soft min-w-[220px] px-5 py-4">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-kantioo-muted">
                Delai annonce
              </p>
              <p className="mt-2 display text-3xl font-bold tracking-[-0.05em] text-kantioo-dark">
                {s.delivery_delay_hours}h
              </p>
            </div>
          </div>

          <p className="mt-8 max-w-3xl text-base leading-8 text-kantioo-muted">
            {s.delivery_zones ||
              "Approvisionnement chantier avec livraison structuree, communication rapide et catalogue adapte aux besoins BTP."}
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-[24px] bg-kantioo-sand px-5 py-5">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-kantioo-muted">
                Catalogue visible
              </p>
              <p className="mt-2 display text-3xl font-bold tracking-[-0.05em] text-kantioo-dark">
                {s.supplier_materials.length}
              </p>
            </div>
            <div className="rounded-[24px] bg-white px-5 py-5 ring-1 ring-kantioo-line">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-kantioo-muted">
                Ville
              </p>
              <p className="mt-2 text-lg font-semibold text-kantioo-dark">{formatCityLabel(s.city)}</p>
            </div>
            <div className="rounded-[24px] bg-white px-5 py-5 ring-1 ring-kantioo-line">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-kantioo-muted">
                Parcours de commande
              </p>
              <p className="mt-2 text-lg font-semibold text-kantioo-dark">
                Assistant Kantioo dedie
              </p>
            </div>
          </div>

          <div className="mt-10 rounded-[30px] border border-kantioo-line bg-white/80 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="eyebrow">En avant</p>
                <h2 className="display mt-2 text-3xl font-bold tracking-[-0.05em] text-kantioo-dark">
                  Materiaux les plus visibles
                </h2>
              </div>
              <Link href={`/commander?supplier=${s.id}`} className="action-primary gap-2">
                Commander chez ce fournisseur
                <ArrowRight size={16} />
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {topMaterials.map((item) => (
                <span
                  key={item.id}
                  className="rounded-full border border-kantioo-line bg-kantioo-sand px-4 py-2 text-sm font-medium text-kantioo-dark"
                >
                  {item.material?.name}
                </span>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="panel p-6">
            <div className="space-y-3">
              <Link href={`/commander?supplier=${s.id}`} className="action-primary flex w-full gap-2">
                <Truck size={18} />
                Commander maintenant
              </Link>
              <div className="rounded-[22px] border border-kantioo-line bg-white px-4 py-4 text-sm leading-6 text-kantioo-muted">
                Les coordonnees directes du fournisseur restent masquees. La suite de la commande se fait via l assistant Kantioo.
              </div>
            </div>

            <div className="mt-6 space-y-3 rounded-[24px] bg-kantioo-sand p-4">
              {[
                `Livraison annoncee en ${s.delivery_delay_hours}h`,
                "Paiement a la livraison possible",
                "Confirmation fournisseur plus simple",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm font-medium text-kantioo-dark">
                  <CheckCircle2 size={16} className="text-kantioo-orange" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="panel p-6">
            <p className="eyebrow">Adresse</p>
            <p className="mt-3 text-base leading-7 text-kantioo-muted">
              {s.address || "Adresse precise communiquee au moment de la commande et de la livraison."}
            </p>
            <div className="mt-5 rounded-[24px] bg-white px-4 py-4 ring-1 ring-kantioo-line">
              <div className="flex items-center gap-3 text-sm font-medium text-kantioo-dark">
                <ShieldCheck size={18} className="text-kantioo-orange" />
                Zone couverte: {s.delivery_zones || `${formatCityLabel(s.city)} et quartiers proches`}
              </div>
            </div>
          </div>

          <div className="panel p-6">
            <p className="eyebrow">Services inclus</p>
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-3 text-sm font-medium text-kantioo-dark">
                <Truck size={18} className="text-kantioo-orange" />
                Livraison chantier coordonnee
              </div>
              <div className="flex items-center gap-3 text-sm font-medium text-kantioo-dark">
                <ShieldCheck size={18} className="text-kantioo-orange" />
                Coordination de commande geree par Kantioo
              </div>
            </div>
          </div>
        </aside>
      </div>

      <section className="mt-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="eyebrow">Catalogue</span>
            <h2 className="section-title mt-2">Materiaux disponibles chez {s.name}.</h2>
          </div>
          <p className="text-sm text-kantioo-muted">
            Choisissez une reference pour pre-remplir votre commande.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {s.supplier_materials.map((item) => (
            <article key={item.id} className="panel overflow-hidden p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-kantioo-sand text-3xl">
                  {item.material?.icon || "[]"}
                </div>
                <span className="rounded-full border border-kantioo-line px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-kantioo-muted">
                  {item.unit}
                </span>
              </div>

              <h3 className="display mt-5 text-3xl font-bold tracking-[-0.05em] text-kantioo-dark">
                {item.material?.name}
              </h3>
              <p className="mt-3 text-sm leading-6 text-kantioo-muted">
                Reference disponible pour commande chantier avec recapitulatif immediat.
              </p>
              <p className="mt-5 text-2xl font-semibold text-kantioo-dark">
                Disponible
                <span className="ml-2 text-sm text-kantioo-muted">/ {item.unit}</span>
              </p>

              <Link
                href={`/assistant-commande?supplier=${s.id}&material=${item.material_id}&city=${formatCityLabel(s.city)}`}
                className="action-primary mt-6 flex w-full gap-2"
              >
                Commander avec l assistant
                <ArrowRight size={16} />
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
