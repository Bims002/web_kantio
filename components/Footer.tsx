import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-kantioo-line bg-[linear-gradient(180deg,rgba(255,255,255,0.2),rgba(255,255,255,0.88))]">
      <div className="shell py-12">
        <div className="panel flex flex-col gap-10 px-6 py-8 md:flex-row md:items-end md:justify-between md:px-8">
          <div className="max-w-xl">
            <span className="eyebrow">Kantioo</span>
            <h2 className="display mt-3 text-3xl font-bold tracking-[-0.05em] text-kantioo-dark">
              Un sourcing plus simple, plus clair, plus rapide.
            </h2>
          </div>

          <div className="flex flex-col gap-3 text-sm text-kantioo-muted md:items-end">
            <div className="flex flex-wrap gap-4">
              <Link href="/" className="hover:text-kantioo-orange">
                Demarrer
              </Link>
            </div>
            <p>Kantioo (c) 2026. Marketplace BTP Cameroun.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
