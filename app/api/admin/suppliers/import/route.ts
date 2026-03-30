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

      let mappedName = '';
      let mappedPhone = '';
      let mappedCity = '';
      let mappedContactName = '';
      let mappedQuartier = '';
      let mappedEmail = '';
      let mappedDelay = '';
      let mappedStock = '';

      for (const [key, val] of Object.entries(row)) {
        if (!key) continue;
        const k = key.toString();
        const value = String(val);

        if (!mappedName && (k === 'name' || k === 'nom' || k === 'fournisseur' || k === 'supplier' || k.includes('entreprise'))) {
          mappedName = value;
        } else if (!mappedPhone && (k === 'phone' || k === 'tel' || k.includes('téléphone') || k.includes('telephone') || k.includes('tlphone') || k.includes('whatsapp') || k.includes('mobile') || k.includes('numro'))) {
          mappedPhone = value;
        } else if (!mappedCity && (k === 'city' || k === 'ville' || k.includes('ville'))) {
          mappedCity = value;
        } else if (!mappedContactName && (k === 'contact_name' || k === 'contact' || k.includes('nom_complet') || k.includes('responsable'))) {
          mappedContactName = value;
        } else if (!mappedQuartier && (k === 'quartier' || k.includes('quartier') || k.includes('zone'))) {
          mappedQuartier = value;
        } else if (!mappedEmail && (k === 'email' || k === 'e-mail')) {
          mappedEmail = value;
        } else if (!mappedDelay && (k.includes('délai') || k.includes('delai') || k.includes('dlai') || k.includes('delay'))) {
          mappedDelay = value;
        } else if (!mappedStock && (k.includes('stock') || k.includes('permanence'))) {
          mappedStock = value;
        }
      }

      const name = mappedName || '';
      const phone = mappedPhone || '';
      const city = mappedCity || '';

      return {
        name: name.trim(),
        phone: phone.trim(),
        contact_name: mappedContactName?.trim() || null,
        email: mappedEmail?.trim() || null,
        city: city.trim() || 'Douala',
        quartier: mappedQuartier?.trim() || null,
        address: mappedQuartier?.trim() || null,
        lat: Number(row.lat) || Number(row.latitude) || 0,
        lng: Number(row.lng) || Number(row.longitude) || 0,
        delivery_radius: Number(row.delivery_radius) || Number(row.rayon) || 20,
        delivery_delay_hours: parseInt(mappedDelay) || Number(row.delivery_delay_hours) || 24,
        stock_availability: mappedStock || row.stock_availability || 'permanent',
        is_active: row.is_active ? String(row.is_active).toLowerCase() === 'true' : true,
        // @ts-ignore – type may not include this field explicitly
        delivery_zones: null,
      } as Supplier;
    });

    // Filtrer les lignes incompletes sans tout faire planter (on garde ceux qui ont au moins un numéro de tél pour le upsert)
    const validPayloads = payloads.filter(p => p.phone && p.phone.length > 3);

    if (validPayloads.length === 0) {
      const detectedColumns = rows.length > 0 ? Object.keys(rows[0]).join(', ') : 'Aucune';
      const firstRowSample = rows.length > 0 ? rows[0] : {};
      
      console.warn("Payload genere depuis la premiere ligne:", payloads[0]);
      
      return Response.json({ 
        error: `Aucun fournisseur valide trouve. Colonnes detectees : [${detectedColumns}]. L'import a echoue car AUCUNE LIGNE ne possede de numero de telephone valide (colonne 'phone' ou 'whatsapp'). Verifiez vos donnees ! Exemple de la 1ere ligne: ${JSON.stringify(firstRowSample).slice(0, 150)}...` 
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
