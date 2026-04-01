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

  // Store markers reference to avoid recreating them
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || mapboxToken.includes('placeholder')) {
      return;
    }

    // If map already exists, just update markers
    if (map.current) {
      // Clear existing markers
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];

      const nextMap = map.current;

      // Move to new center if changed
      if (center) {
        nextMap.setCenter(center);
      }
      if (zoom) {
        nextMap.setZoom(zoom);
      }

      // Add supplier markers
      let validCount = 0;
      suppliers.forEach((supplier, index) => {
        if (!supplier.lat || !supplier.lng) {
          console.warn(`Supplier[${index + 1}] ${supplier.name} has no coords (lat=${supplier.lat}, lng=${supplier.lng})`);
          return;
        }
        validCount++;

        const popup = new mapboxgl.Popup({ offset: 18, maxWidth: '280px' }).setHTML(`
          <div style="padding: 10px 8px; min-width: 200px; font-family: system-ui, sans-serif;">
            <div style="font-size: 15px; font-weight: 700; color: #1b130c; margin-bottom: 4px;">${supplier.name}</div>
            <div style="font-size: 12px; color: #6d6258; margin-bottom: 10px;">${supplier.quartier || ''}${supplier.quartier ? ', ' : ''}${formatCityLabel(supplier.city)}</div>
            <a href="/fournisseurs/${supplier.id}" style="display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; background: #e8650a; color: white; text-decoration: none; padding: 8px 14px; font-size: 12px; font-weight: 700;">
              Voir le profil
            </a>
          </div>
        `);

        const marker = new mapboxgl.Marker({
          color: '#e8650a',
          scale: 0.8,
        })
          .setLngLat([supplier.lng, supplier.lat])
          .setPopup(popup)
          .addTo(nextMap);

        markersRef.current.push(marker);
      });

      // Add SITE marker if coordinates exist
      if (siteCoords) {
        const siteNode = document.createElement('div');
        siteNode.style.width = '22px';
        siteNode.style.height = '22px';
        siteNode.style.borderRadius = '999px';
        siteNode.style.border = '3px solid white';
        siteNode.style.background = '#3b82f6';
        siteNode.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.3)';

        new mapboxgl.Marker(siteNode)
          .setLngLat([siteCoords.lng, siteCoords.lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 18 }).setHTML(`
              <div style="padding: 10px; font-family: system-ui, sans-serif; text-align: center;">
                <div style="font-weight: 800; color: #1e3a8a; font-size: 13px;">VOTRE CHANTIER</div>
                <div style="font-size: 12px; color: #475569; margin-top: 4px;">Emplacement détecté par l'assistant</div>
              </div>
            `)
          )
          .addTo(nextMap);

        nextMap.flyTo({
          center: [siteCoords.lng, siteCoords.lat],
          zoom: 13,
          essential: true,
        });
      }

      return;
    }

    // Initialize map
    mapboxgl.accessToken = mapboxToken;

    const nextMap = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center,
      zoom,
    });
    map.current = nextMap;

    nextMap.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Wait for map to load before adding markers
    nextMap.on('load', () => {
      // Add supplier markers
      suppliers.forEach((supplier, index) => {
        if (!supplier.lat || !supplier.lng) return;

        const popup = new mapboxgl.Popup({ offset: 18, maxWidth: '280px' }).setHTML(`
          <div style="padding: 10px 8px; min-width: 200px; font-family: system-ui, sans-serif;">
            <div style="font-size: 15px; font-weight: 700; color: #1b130c; margin-bottom: 4px;">${supplier.name}</div>
            <div style="font-size: 12px; color: #6d6258; margin-bottom: 10px;">${supplier.quartier || ''}${supplier.quartier ? ', ' : ''}${formatCityLabel(supplier.city)}</div>
            <a href="/fournisseurs/${supplier.id}" style="display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; background: #e8650a; color: white; text-decoration: none; padding: 8px 14px; font-size: 12px; font-weight: 700;">
              Voir le profil
            </a>
          </div>
        `);

        const marker = new mapboxgl.Marker({
          color: '#e8650a',
          scale: 0.8,
        })
          .setLngLat([supplier.lng, supplier.lat])
          .setPopup(popup)
          .addTo(nextMap);

        markersRef.current.push(marker);
      });

      // Add SITE marker if coordinates exist
      if (siteCoords) {
        const siteNode = document.createElement('div');
        siteNode.style.width = '22px';
        siteNode.style.height = '22px';
        siteNode.style.borderRadius = '999px';
        siteNode.style.border = '3px solid white';
        siteNode.style.background = '#3b82f6';
        siteNode.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.3)';

        new mapboxgl.Marker(siteNode)
          .setLngLat([siteCoords.lng, siteCoords.lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 18 }).setHTML(`
              <div style="padding: 10px; font-family: system-ui, sans-serif; text-align: center;">
                <div style="font-weight: 800; color: #1e3a8a; font-size: 13px;">VOTRE CHANTIER</div>
                <div style="font-size: 12px; color: #475569; margin-top: 4px;">Emplacement détecté par l'assistant</div>
              </div>
            `)
          )
          .addTo(nextMap);

        nextMap.flyTo({
          center: [siteCoords.lng, siteCoords.lat],
          zoom: 13,
          essential: true,
        });
      }
    });

    // Cleanup function
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      nextMap.remove();
      map.current = null;
    };
  }, [center, zoom, suppliers, siteCoords, mapboxToken]);

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
