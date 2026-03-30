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

    if (errors.length > 0) {
      console.warn('PapaParse warnings:', errors);
    }

    if (rows.length === 0) {
      const msg = errors.length > 0 ? errors[0].message : 'Fichier CSV vide ou invalide.';
      return Response.json({ error: `Erreur de lecture CSV: ${msg}` }, { status: 400 });
    }
    const payloads: Supplier[] = rows.map((originalRow) => {
      // Normaliser les clés (minuscules, sans espaces, retrait du BOM)
      const row: any = {};
      for (const [key, value] of Object.entries(originalRow)) {
        if (key) {
          const cleanKey = key.toLowerCase().replace(/[\uFEFF\xA0]/g, '').trim();
          row[cleanKey] = value;
        }
      }

      const name = row.name || row.nom || row.fournisseur || row.supplier || '';
      const phone = row.phone || row.tel || row.téléphone || row.telephone || row.phone_number || row.mobile || '';
      const city = row.city || row.ville || '';

      return {
        name: name.trim(),
        phone: phone.trim(),
        contact_name: row.contact_name?.trim() ?? row.contact?.trim() ?? null,
        email: row.email?.trim() ?? null,
        city: city.trim() ?? 'Douala',
        quartier: row.quartier?.trim() ?? null,
        address: row.address?.trim() ?? row.adresse?.trim() ?? null,
        lat: Number(row.lat) || Number(row.latitude) || 0,
        lng: Number(row.lng) || Number(row.longitude) || 0,
        delivery_radius: Number(row.delivery_radius) || Number(row.rayon) || 20,
        delivery_delay_hours: Number(row.delivery_delay_hours) || Number(row.delai) || 24,
        stock_availability: row.stock_availability ?? row.stock ?? 'permanent',
        is_active: row.is_active ? String(row.is_active).toLowerCase() === 'true' : true,
        // @ts-ignore – type may not include this field explicitly
        delivery_zones: null,
      } as Supplier;
    });

    // Filtrer les lignes incompletes sans tout faire planter
    const validPayloads = payloads.filter(p => p.name && p.phone && p.city);

    if (validPayloads.length === 0) {
      const detectedColumns = rows.length > 0 ? Object.keys(rows[0]).join(', ') : 'Aucune';
      return Response.json({ 
        error: `Aucun fournisseur valide trouve. Colonnes detectees dans votre CSV : [${detectedColumns}]. Verifiez que vous avez bien des colonnes nommees "Nom", "Tel" et "Ville" (ou equivalent).` 
      }, { status: 400 });
    }

    const { data, error } = await supabaseServer
      .from('suppliers')
      .upsert(validPayloads, { onConflict: 'phone,email' })
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
