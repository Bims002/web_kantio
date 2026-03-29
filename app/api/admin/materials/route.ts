import { requireAdminRequest, getRouteErrorMessage } from '@/lib/admin-route';
import { supabaseServer } from '@/lib/supabase-server';

export const runtime = 'nodejs';

interface MaterialPayload {
  name?: string;
  category?: string;
  unit?: string;
  icon?: string | null;
}

function sanitizeMaterialPayload(body: MaterialPayload) {
  return {
    name: body.name?.trim() || '',
    category: body.category?.trim() || '',
    unit: body.unit?.trim() || '',
    icon: body.icon?.trim() || null,
  };
}

export async function POST(request: Request) {
  const auth = await requireAdminRequest();

  if (auth.response) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as MaterialPayload;
    const payload = sanitizeMaterialPayload(body);

    if (!payload.name || !payload.category || !payload.unit) {
      return Response.json(
        { error: 'Nom, categorie et unite sont obligatoires.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseServer
      .from('materials')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return Response.json({ material: data });
  } catch (error) {
    return Response.json(
      {
        error: getRouteErrorMessage(
          error,
          "Impossible d'enregistrer l'article."
        ),
      },
      { status: 500 }
    );
  }
}
