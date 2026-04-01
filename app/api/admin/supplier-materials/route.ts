import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin-auth';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
    }

    const body = await request.json();
    const { supplier_id, material_id, unit } = body;

    if (!supplier_id || !material_id || !unit) {
      return NextResponse.json({ error: 'Tous les champs sont requis' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if already exists
    const { data: existing } = await supabase
      .from('supplier_materials')
      .select('id')
      .eq('supplier_id', supplier_id)
      .eq('material_id', material_id)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Cet article est deja associe a ce fournisseur' }, { status: 400 });
    }

    const { error } = await supabase
      .from('supplier_materials')
      .insert({
        supplier_id,
        material_id,
        unit,
      });

    if (error) {
      console.error('Error creating supplier material:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Create supplier material error:', error);
    return NextResponse.json({ error: 'Erreur lors de l\'ajout' }, { status: 500 });
  }
}