'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LockKeyhole, LogIn } from 'lucide-react';

export default function AdminLogin({
  defaultEmail,
}: {
  defaultEmail: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || 'Connexion admin impossible.');
      }

      // Full page reload to pick up the new session cookie
      window.location.reload();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Connexion admin impossible.';
      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="shell py-12 sm:py-16">
      <div className="mx-auto max-w-[520px]">
        <section className="panel px-6 py-8 sm:px-8 sm:py-10">
          <div className="inline-flex rounded-full bg-kantioo-sand px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-kantioo-dark">
            Acces admin securise
          </div>

          <h1 className="section-title mt-4">Connexion a l espace admin</h1>
          <p className="mt-3 text-sm leading-7 text-kantioo-muted">
            Cet acces utilise une session serveur HTTP-only. Les operations de gestion passent
            ensuite par des routes admin securisees cote serveur.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <label className="block rounded-[22px] border border-kantioo-line bg-white px-4 py-3">
              <span className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-kantioo-muted">
                Email admin
              </span>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full bg-transparent text-sm font-semibold text-kantioo-dark outline-none"
              />
            </label>

            <label className="block rounded-[22px] border border-kantioo-line bg-white px-4 py-3">
              <span className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-kantioo-muted">
                Mot de passe
              </span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full bg-transparent text-sm font-semibold text-kantioo-dark outline-none"
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="action-primary w-full justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <LockKeyhole size={16} /> : <LogIn size={16} />}
              {submitting ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          {errorMessage ? (
            <div className="mt-4 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
