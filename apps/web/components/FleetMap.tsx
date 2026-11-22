"use client";

import useSWR from "swr";
import { LazyMap, type TaxiMarkerData, type StationMarkerData } from "@/components/map";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { STATION_COORDS } from "@/lib/geo/places";
import type { FleetResponse } from "@/lib/types";

interface FleetMapProps {
  className?: string;
}

export function FleetMap({ className = "h-96 w-full rounded-2xl overflow-hidden border border-line" }: FleetMapProps) {
  const t = useT();
  const { data: fleet, error, isLoading } = useSWR<FleetResponse>(
    "/admin/fleet",
    () => api.fleet(),
    { refreshInterval: 5000 }
  );

  // Default Jimma center
  const center: [number, number] = [7.6686, 36.8313];

  const taxiMarkers: TaxiMarkerData[] = (fleet?.taxis ?? [])
    .filter((taxi) => taxi.position !== null)
    .map((taxi) => ({
      id: taxi.id,
      lat: taxi.position!.lat,
      lng: taxi.position!.lng,
      heading: taxi.position!.heading,
      plate: taxi.plate,
      stale: taxi.position!.stale,
    }));

  const stationMarkers: StationMarkerData[] = (fleet?.stations ?? []).map((station) => {
    const coords = STATION_COORDS[station.name] ?? { lat: station.lat ?? center[0], lng: station.lng ?? center[1] };
    return {
      id: station.id,
      name: station.name,
      lat: coords.lat,
      lng: coords.lng,
    };
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-bold text-ink">
          {t("fleet.title", "Live Fleet Map")}
        </h3>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-taxi" />
            {taxiMarkers.length} {t("fleet.activeTaxis", "Taxis")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" />
            {stationMarkers.length} {t("fleet.stations", "Stations")}
          </span>
        </div>
      </div>

      <div className={className}>
        <LazyMap
          center={center}
          zoom={14}
          taxiMarkers={taxiMarkers}
          stationMarkers={stationMarkers}
          className="h-full w-full"
        />
      </div>
    </div>
  );
}
