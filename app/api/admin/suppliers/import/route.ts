import { requireAdminRequest, getRouteErrorMessage } from '@/lib/admin-route';
import { supabaseServer } from '@/lib/supabase-server';
import type { Supplier } from '@/lib/types';
import Papa from 'papaparse'; // Papaparse parser

export const runtime = 'nodejs';

/**
 * Expected CSV headers (case‑insensitive):
 * name, phone, contact_name, email, city, quartier, address, lat, lng,
 * delivery_radius, delivery_delay_hours, stock_availability, is_active
 */
export async function POST(request: Request) {
  const auth = await requireAdminRequest();
  if (auth.response) return auth.response;

  try {
    const form = await request.formData();
    const file = form.get('file') as File | null;
    if (!file) {
      return Response.json({ error: 'Fichier CSV manquant.' }, { status: 400 });
    }
    const text = await file.text();
    const parseResult = Papa.parse<any>(text, {
      header: true,
      skipEmptyLines: true,
    });
const rows = parseResult.data as any[];
const errors = parseResult.errors;

    if (errors.length) {
      return Response.json({ error: 'Erreur de parsing CSV.' }, { status: 400 });
    }

    const payloads: Supplier[] = rows.map((row) => ({
      name: (row.name ?? '').trim(),
      phone: (row.phone ?? '').trim(),
      contact_name: row.contact_name?.trim() ?? null,
      email: row.email?.trim() ?? null,
      city: row.city?.trim() ?? '',
      quartier: row.quartier?.trim() ?? null,
      address: row.address?.trim() ?? null,
      lat: Number(row.lat) || 0,
      lng: Number(row.lng) || 0,
      delivery_radius: Number(row.delivery_radius) || 20,
      delivery_delay_hours: Number(row.delivery_delay_hours) || 24,
      stock_availability: row.stock_availability ?? 'permanent',
      is_active: row.is_active ? String(row.is_active).toLowerCase() === 'true' : true,
      // @ts-ignore – type may not include this field explicitly
      delivery_zones: null,
    } as Supplier));

    for (const p of payloads) {
      if (!p.name || !p.phone || !p.city) {
        return Response.json({ error: 'Chaque ligne doit contenir au moins name, phone et city.' }, { status: 400 });
      }
    }

    const { data, error } = await supabaseServer
      .from('suppliers')
      .upsert(payloads, { onConflict: 'phone,email' })
      .select('*');
    if (error) throw error;

    return Response.json({ inserted: data?.length ?? 0, suppliers: data });
  } catch (err) {
    return Response.json(
      { error: getRouteErrorMessage(err, "Impossible d'importer les fournisseurs.") },
      { status: 500 }
    );
  }
}
