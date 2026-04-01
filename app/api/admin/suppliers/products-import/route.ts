import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin-auth';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    // Verify admin session
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
    }

    // Read CSV file
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      return NextResponse.json({ error: 'Le fichier est vide ou invalide' }, { status: 400 });
    }

    // Parse header to detect column format
    const header = lines[0].toLowerCase().trim();
    
    // Expected format: phone, material_name, price, unit
    // Example: 655123456, Ciment, 5000, sac
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all existing materials
    const { data: existingMaterials, error: materialsError } = await supabase
      .from('materials')
      .select('*');

    if (materialsError) {
      return NextResponse.json({ error: 'Erreur lors de la recuperation des materiaux' }, { status: 500 });
    }

    // Fetch all existing suppliers
    const { data: existingSuppliers, error: suppliersError } = await supabase
      .from('suppliers')
      .select('*');

    if (suppliersError) {
      return NextResponse.json({ error: 'Erreur lors de la recuperation des fournisseurs' }, { status: 500 });
    }

    let imported = 0;
    let skipped = 0;
    let errors: string[] = [];

    // Process each line (skip header)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;

      const parts = line.split(/[,;]/).map(p => p.trim().replace(/^["']|["']$/g, ''));

      if (parts.length < 2) {
        errors.push(`Ligne ${i + 1}: Format invalide`);
        skipped++;
        continue;
      }

      const [phone, materialName, priceStr, unit] = parts;
      const price = parseInt(priceStr) || 0;

      // Find supplier by phone
      const supplier = existingSuppliers.find(s => 
        s.phone.replace(/\s/g, '') === phone.replace(/\s/g, '')
      );

      if (!supplier) {
        errors.push(`Ligne ${i + 1}: Fournisseur avec numero ${phone} non trouve`);
        skipped++;
        continue;
      }

      // Find or create material
      let material = existingMaterials.find(m => 
        m.name.toLowerCase() === materialName.toLowerCase()
      );

      if (!material) {
        // Create new material with default values
        const { data: newMaterial, error: createError } = await supabase
          .from('materials')
          .insert({
            name: materialName,
            category: 'divers',
            unit: unit || 'unite',
          })
          .select()
          .single();

        if (createError) {
          errors.push(`Ligne ${i + 1}: Erreur creation materiau ${materialName}`);
          skipped++;
          continue;
        }

        existingMaterials.push(newMaterial);
        material = newMaterial;
      }

      // Check if association already exists
      const { data: existingAssociation } = await supabase
        .from('supplier_materials')
        .select('*')
        .eq('supplier_id', supplier.id)
        .eq('material_id', material.id)
        .single();

      if (existingAssociation) {
        // Update price if provided
        if (price > 0) {
          const { error: updateError } = await supabase
            .from('supplier_materials')
            .update({ unit: unit || existingAssociation.unit })
            .eq('id', existingAssociation.id);

          if (updateError) {
            errors.push(`Ligne ${i + 1}: Erreur mise a jour`);
            skipped++;
            continue;
          }
        }
        skipped++;
        continue;
      }

      // Create association
      const { error: assocError } = await supabase
        .from('supplier_materials')
        .insert({
          supplier_id: supplier.id,
          material_id: material.id,
          unit: unit || 'unite',
        });

      if (assocError) {
        errors.push(`Ligne ${i + 1}: Erreur association`);
        skipped++;
        continue;
      }

      imported++;
    }

    return NextResponse.json({
      imported,
      skipped,
      errors: errors.length > 0 ? errors : null,
    });
  } catch (error) {
    console.error('Products import error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Erreur lors de l\'import' 
    }, { status: 500 });
  }
}