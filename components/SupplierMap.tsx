'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { formatCityLabel } from '@/lib/cities';
import type { Supplier } from '@/lib/types';

interface Props {
  suppliers: Supplier[];
  center?: [number, number];
  zoom?: number;
  siteCoords?: { lat: number; lng: number } | null;
}

export default function SupplierMap({
  suppliers,
  center = [11.5167, 3.8667],
  zoom = 6,
  siteCoords = null,
}: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken] = useState(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || mapboxToken.includes('placeholder')) {
      return;
    }

    mapboxgl.accessToken = mapboxToken;

    const nextMap = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center,
      zoom,
    });
    map.current = nextMap;

    nextMap.addControl(new mapboxgl.NavigationControl(), 'top-right');

    suppliers.forEach((supplier) => {
      const markerNode = document.createElement('button');
      markerNode.type = 'button';
      markerNode.setAttribute('aria-label', supplier.name);
      markerNode.style.width = '18px';
      markerNode.style.height = '18px';
      markerNode.style.borderRadius = '999px';
      markerNode.style.border = '2.5px solid white';
      markerNode.style.background = '#e8650a';
      markerNode.style.boxShadow = '0 8px 16px -8px rgba(27, 19, 12, 0.7)';

      new mapboxgl.Marker(markerNode)
        .setLngLat([supplier.lng, supplier.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 24 }).setHTML(`
            <div style="padding: 6px 4px; min-width: 220px; font-family: sans-serif;">
              <div style="font-size: 16px; font-weight: 700; color: #1b130c;">${supplier.name}</div>
              <div style="margin-top: 4px; font-size: 12px; color: #6d6258;">${supplier.quartier || ''}${supplier.quartier ? ', ' : ''}${formatCityLabel(supplier.city)}</div>
              <a
                href="/fournisseurs/${supplier.id}"
                style="display: inline-flex; margin-top: 12px; align-items: center; justify-content: center; border-radius: 999px; background: #e8650a; color: white; text-decoration: none; padding: 10px 14px; font-size: 12px; font-weight: 700;"
              >
                Voir le profil
              </a>
            </div>
          `)
        )
        .addTo(nextMap);
    });

    // Add SITE marker if coordinates exist
    if (siteCoords) {
      const siteNode = document.createElement('div');
      siteNode.style.width = '24px';
      siteNode.style.height = '24px';
      siteNode.style.borderRadius = '999px';
      siteNode.style.border = '4px solid white';
      siteNode.style.background = '#3b82f6'; // Blue for site
      siteNode.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.4)';
      siteNode.className = 'animate-pulse';

      new mapboxgl.Marker(siteNode)
        .setLngLat([siteCoords.lng, siteCoords.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 24 }).setHTML(`
            <div style="padding: 10px; font-family: sans-serif; text-align: center;">
              <div style="font-weight: 800; color: #1e3a8a;">VOTRE CHANTIER</div>
              <div style="font-size: 12px; color: #475569; margin-top: 4px;">Emplacement détecté par l'assistant</div>
            </div>
          `)
        )
        .addTo(nextMap);

      // Center on site
      nextMap.flyTo({
        center: [siteCoords.lng, siteCoords.lat],
        zoom: 13,
        essential: true
      });
    }

    return () => {
      nextMap.remove();
      map.current = null;
    };
  }, [center, mapboxToken, suppliers, zoom, siteCoords]);

  if (!mapboxToken || mapboxToken.includes('placeholder')) {
    return (
      <div className="flex h-full min-h-[440px] w-full items-center justify-center rounded-[26px] bg-[linear-gradient(180deg,rgba(255,248,239,0.9),rgba(255,255,255,0.7))] p-8 text-center">
        <div className="max-w-sm">
          <p className="display text-3xl font-bold tracking-[-0.05em] text-kantioo-dark">
            Carte indisponible
          </p>
          <p className="mt-3 text-sm leading-6 text-kantioo-muted">
            Ajoutez `NEXT_PUBLIC_MAPBOX_TOKEN` dans `.env.local` pour activer la carte interactive.
          </p>
        </div>
      </div>
    );
  }

  return <div ref={mapContainer} className="h-full min-h-[440px] w-full rounded-[26px]" />;
}
