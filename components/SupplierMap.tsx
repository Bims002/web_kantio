'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { formatCityLabel } from '@/lib/cities';
import type { Supplier } from '@/lib/types';

// Coordonnées des quartiers de Douala et Yaoundé (comme dans order-assistant.ts)
const QUARTIER_COORDS: Record<string, Record<string, { lat: number; lng: number }>> = {
  douala: {
    akwa: { lat: 4.0508, lng: 9.6963 },
    bonapriso: { lat: 4.0321, lng: 9.6974 },
    deido: { lat: 4.0617, lng: 9.7075 },
    bonamoussadi: { lat: 4.0927, lng: 9.7402 },
    logpom: { lat: 4.1026, lng: 9.7495 },
    ndokoti: { lat: 4.0492, lng: 9.7391 },
    bassa: { lat: 4.0458, lng: 9.7483 },
    bali: { lat: 4.0416, lng: 9.6922 },
    kotto: { lat: 4.1084, lng: 9.7583 },
    japoma: { lat: 4.0152, lng: 9.7947 },
    makepe: { lat: 4.0812, lng: 9.7541 },
    bepanda: { lat: 4.0658, lng: 9.7283 },
    nyalla: { lat: 4.0258, lng: 9.7783 },
    yassa: { lat: 4.0058, lng: 9.8183 },
    logbessou: { lat: 4.1258, lng: 9.7683 },
    cite_des_palmiers: { lat: 4.0758, lng: 9.7483 },
    bonaberi: { lat: 4.0758, lng: 9.6683 },
    ndogpassi: { lat: 4.0258, lng: 9.7683 },
    soboum: { lat: 4.0358, lng: 9.7283 },
    pk14: { lat: 4.1158, lng: 9.8083 },
    pk12: { lat: 4.1058, lng: 9.7903 },
  },
  yaounde: {
    bastos: { lat: 3.894, lng: 11.5109 },
    mvan: { lat: 3.8122, lng: 11.5158 },
    messassi: { lat: 3.9312, lng: 11.5284 },
    odza: { lat: 3.7945, lng: 11.5412 },
    tsinga: { lat: 3.8821, lng: 11.4984 },
    efoulan: { lat: 3.8214, lng: 11.4984 },
    mendong: { lat: 3.8342, lng: 11.4782 },
    biem_assi: { lat: 3.8412, lng: 11.4884 },
    ngo_eke: { lat: 3.8542, lng: 11.5312 },
    mimboman: { lat: 3.8642, lng: 11.5512 },
    mvog_bi: { lat: 3.8412, lng: 11.5112 },
    essos: { lat: 3.8712, lng: 11.5312 },
    ngousso: { lat: 3.8912, lng: 11.5412 },
    ekounou: { lat: 3.8312, lng: 11.5312 },
    etoudi: { lat: 3.9112, lng: 11.5112 },
    damas: { lat: 3.8212, lng: 11.4812 },
    mvog_ada: { lat: 3.8612, lng: 11.5212 },
    obobogo: { lat: 3.8112, lng: 11.5012 },
    ahala: { lat: 3.7812, lng: 11.5112 },
    nkoabang: { lat: 3.8512, lng: 11.5812 },
    mballa_2: { lat: 3.8912, lng: 11.5212 },
  },
};

// Coordonnées des villes
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  douala: { lat: 4.05, lng: 9.7 },
  yaounde: { lat: 3.86, lng: 11.5 },
};

function getSupplierCoords(supplier: Supplier): [number, number] | null {
  // 1. If lat/lng are valid, use them
  if (supplier.lat && supplier.lng && Math.abs(supplier.lat) > 0.01 && Math.abs(supplier.lng) > 0.01) {
    return [supplier.lng, supplier.lat];
  }

  // 2. Try quartier + ville
  const cityKey = (supplier.city || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const quartier = (supplier.quartier || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  
  if (cityKey && quartier) {
    const cityQuartiers = QUARTIER_COORDS[cityKey];
    if (cityQuartiers) {
      // Find matching quartier (using token-based scoring)
      const tokens = quartier.split(/\s+/).filter(t => t.length >= 2);
      let bestKey: string | null = null;
      let highestScore = 0;
      
      Object.keys(cityQuartiers).forEach(key => {
        const normalizedKey = key.replace(/_/g, ' ');
        let score = 0;
        if (quartier.includes(normalizedKey)) score += 50;
        tokens.forEach(token => {
          if (normalizedKey.includes(token)) score += 20;
        });
        if (score > highestScore) {
          highestScore = score;
          bestKey = key;
        }
      });
      
      if (bestKey && highestScore >= 30) {
        const coords = cityQuartiers[bestKey];
        return [coords.lng, coords.lat];
      }
    }
  }

  // 3. Fall back to city center
  if (cityKey && CITY_COORDS[cityKey]) {
    return [CITY_COORDS[cityKey].lng, CITY_COORDS[cityKey].lat];
  }

  return null;
}

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
        const coords = getSupplierCoords(supplier);
        if (!coords) {
          console.warn(`Supplier[${index + 1}] ${supplier.name} has no coords: city=${supplier.city}, quartier=${supplier.quartier}, lat=${supplier.lat}, lng=${supplier.lng}`);
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
          .setLngLat(coords)
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
        const coords = getSupplierCoords(supplier);
        if (!coords) return;

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
          .setLngLat(coords)
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
