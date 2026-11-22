"use client";

import { useEffect, useRef } from "react";

export interface TaxiMarkerData {
  id: string;
  lat: number;
  lng: number;
  heading: number | null;
  plate: string;
  stale?: boolean;
}

export interface StationMarkerData {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface TaxiMapProps {
  center: [number, number];
  zoom?: number;
  taxiMarkers?: TaxiMarkerData[];
  passengerPin?: { lat: number; lng: number };
  stationMarkers?: StationMarkerData[];
  polyline?: [number, number][];
  accuracyMeters?: number;
  onMapClick?: (lat: number, lng: number) => void;
  className?: string;
}

export function TaxiMap({
  center,
  zoom = 14,
  taxiMarkers = [],
  passengerPin,
  stationMarkers = [],
  polyline,
  accuracyMeters,
  onMapClick,
  className,
}: TaxiMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const layerGroupRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const onMapClickRef = useRef(onMapClick);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current) return;
    let isCancelled = false;

    import("leaflet").then((L) => {
      if (isCancelled || !mapRef.current) return;
      leafletRef.current = L;

      // Clean up previous map instance if exists
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapRef.current, {
        center,
        zoom,
        attributionControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      map.on("click", (e: any) => {
        onMapClickRef.current?.(e.latlng.lat, e.latlng.lng);
      });

      const layerGroup = L.layerGroup().addTo(map);
      layerGroupRef.current = layerGroup;
      mapInstanceRef.current = map;

      // Render initial overlays
      renderOverlays(L, layerGroup);
    });

    return () => {
      isCancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        layerGroupRef.current = null;
      }
    };
  }, [center[0], center[1], zoom]);

  // Function to render overlays (markers, lines, circles)
  const renderOverlays = (L: any, layerGroup: any) => {
    if (!L || !layerGroup) return;
    layerGroup.clearLayers();

    // 1. Polyline
    if (polyline && polyline.length > 0) {
      L.polyline(polyline, {
        color: "#1d4e9e",
        weight: 4,
        opacity: 0.8,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(layerGroup);
    }

    // 2. Accuracy circle & Passenger Pin
    if (passengerPin) {
      if (accuracyMeters && accuracyMeters > 0) {
        L.circle([passengerPin.lat, passengerPin.lng], {
          radius: accuracyMeters,
          color: "#1d4e9e",
          weight: 1,
          fillColor: "#1d4e9e",
          fillOpacity: 0.12,
        }).addTo(layerGroup);
      }

      const passengerIcon = L.divIcon({
        className: "custom-passenger-pin",
        html: `
          <div style="transform:translate(-50%, -100%); display:flex; flex-direction:column; align-items:center;">
            <svg width="28" height="36" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 20 12 20s12-11 12-20c0-6.63-5.37-12-12-12z" fill="#1d4e9e"/>
              <circle cx="12" cy="12" r="5" fill="#ffffff"/>
            </svg>
          </div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      L.marker([passengerPin.lat, passengerPin.lng], { icon: passengerIcon })
        .bindTooltip("You are here", { direction: "top", offset: [0, -32] })
        .addTo(layerGroup);
    }

    // 3. Station Markers
    for (const st of stationMarkers) {
      const stationIcon = L.divIcon({
        className: "custom-station-pin",
        html: `
          <div style="transform:translate(-50%, -50%); display:flex; align-items:center; justify-content:center;">
            <div style="width:16px; height:16px; background:#1f9d6b; border:2.5px solid #ffffff; border-radius:50%; box-shadow:0 1px 4px rgba(0,0,0,0.35);"></div>
          </div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      L.marker([st.lat, st.lng], { icon: stationIcon })
        .bindTooltip(st.name, { permanent: false, direction: "top", offset: [0, -10] })
        .addTo(layerGroup);
    }

    // 4. Taxi Markers
    for (const taxi of taxiMarkers) {
      const rotation = taxi.heading != null ? taxi.heading : 0;
      const opacity = taxi.stale ? "0.4" : "1";
      const taxiIcon = L.divIcon({
        className: "custom-taxi-pin",
        html: `
          <div style="display:flex; flex-direction:column; align-items:center; opacity:${opacity}; transform:translate(-50%, -50%);">
            <div style="transform: rotate(${rotation}deg); width:28px; height:28px; background:#f5b800; border:2px solid #0e1b33; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 4px rgba(0,0,0,0.3);">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#0e1b33" xmlns="http://www.w3.org/2000/svg">
                <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
              </svg>
            </div>
            <span style="background:#0e1b33; color:#ffffff; font-size:10px; font-weight:bold; padding:1px 4px; border-radius:4px; white-space:nowrap; margin-top:2px;">
              ${taxi.plate}
            </span>
          </div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([taxi.lat, taxi.lng], { icon: taxiIcon });
      if (taxi.stale) {
        marker.bindTooltip("Signal stale (> 60s ago)", { direction: "top", offset: [0, -20] });
      } else {
        marker.bindTooltip(`Taxi ${taxi.plate}`, { direction: "top", offset: [0, -20] });
      }
      marker.addTo(layerGroup);
    }
  };

  // Update overlays when props change without recreating the map
  useEffect(() => {
    if (leafletRef.current && layerGroupRef.current) {
      renderOverlays(leafletRef.current, layerGroupRef.current);
    }
  }, [taxiMarkers, passengerPin, stationMarkers, polyline, accuracyMeters]);

  return (
    <div
      ref={mapRef}
      className={className ?? "h-64 w-full rounded-xl overflow-hidden relative z-0"}
      aria-label="Map showing taxis and stations"
      role="img"
    />
  );
}
