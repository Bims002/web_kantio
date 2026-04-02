import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-kantioo-line bg-white/74 backdrop-blur-xl">
      <div className="shell flex h-20 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-kantioo-dark text-sm font-bold text-white shadow-[0_18px_28px_-20px_rgba(27,19,12,0.9)]">
            K
          </span>
          <span>
            <span className="display block text-xl font-bold tracking-[-0.05em] text-kantioo-dark">
              Kantioo
            </span>
            <span className="block text-[0.68rem] uppercase tracking-[0.28em] text-kantioo-muted">
              Restez où vous êtes
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/fournisseurs"
            className="inline-flex items-center gap-2 rounded-full bg-kantioo-orange px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_36px_-24px_rgba(232,101,10,0.85)] hover:-translate-y-0.5 hover:bg-[#c84f00] sm:px-5"
          >
            Demarrer
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </nav>
  );
}
