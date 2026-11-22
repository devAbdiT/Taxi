"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { LazyMap, type TaxiMarkerData } from "@/components/map";
import { useGeolocation } from "@/hooks/useGeolocation";
import { LocationConsentSheet } from "@/components/LocationConsentSheet";
import { useToast } from "@/components/Providers";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { MyPickupResponse, NearbyTaxisResponse } from "@/lib/types";

// Jimma default coordinates
const JIMMA_CENTER: [number, number] = [7.6686, 36.8313];

export default function PassengerPickupPage() {
  const t = useT();
  const toast = useToast();
  const geo = useGeolocation();

  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [seats, setSeats] = useState(1);
  const [placeNote, setPlaceNote] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Poll current pickup request
  const { data: myPickup, mutate: mutatePickup } = useSWR<MyPickupResponse>(
    "/pickups/mine",
    () => api.myPickup(),
    { refreshInterval: 3000 }
  );

  // Nearby taxis layer
  const currentLat = pin?.lat ?? geo.lat ?? JIMMA_CENTER[0];
  const currentLng = pin?.lng ?? geo.lng ?? JIMMA_CENTER[1];
  const { data: nearby } = useSWR<NearbyTaxisResponse>(
    `/taxis/nearby?lat=${currentLat}&lng=${currentLng}`,
    () => api.nearbyTaxis(currentLat, currentLng),
    { refreshInterval: 5000 }
  );

  // Auto-init pin with GPS when available
  useEffect(() => {
    if (geo.lat && geo.lng && !pin) {
      setPin({ lat: geo.lat, lng: geo.lng });
    }
  }, [geo.lat, geo.lng, pin]);

  function handleUseMyLocation() {
    geo.startWatching();
    if (geo.lat && geo.lng) {
      setPin({ lat: geo.lat, lng: geo.lng });
      toast("Location updated from GPS");
    } else {
      toast("Acquiring GPS fix...");
    }
  }

  async function handleCreatePickup() {
    const target = pin ?? (geo.lat && geo.lng ? { lat: geo.lat, lng: geo.lng } : { lat: JIMMA_CENTER[0], lng: JIMMA_CENTER[1] });
    setRequesting(true);
    try {
      await api.createPickup({
        lat: target.lat,
        lng: target.lng,
        seats,
        placeNote: placeNote.trim() || undefined,
      });
      toast(t("pickup.searching", "Finding nearby drivers"));
      await mutatePickup();
    } catch (err: any) {
      toast(err?.message ?? t("common.error", "Could not create pickup"));
    } finally {
      setRequesting(false);
    }
  }

  async function handleCancelPickup() {
    if (!myPickup?.pickup) return;
    setCancelling(true);
    try {
      await api.cancelPickup(myPickup.pickup.id, { reason: "Passenger cancelled" });
      toast(t("pickup.cancelled", "Pickup request cancelled"));
      await mutatePickup();
    } catch (err: any) {
      toast(err?.message ?? t("common.error", "Could not cancel"));
    } finally {
      setCancelling(false);
    }
  }

  const pickup = myPickup?.pickup;
  const isLive = pickup && (pickup.status === "OPEN" || pickup.status === "ACCEPTED" || pickup.status === "ARRIVED");

  const taxiMarkers: TaxiMarkerData[] = (nearby?.taxis ?? []).map((t) => ({
    id: t.id,
    lat: t.lat,
    lng: t.lng,
    heading: null,
    plate: t.plate,
    stale: t.stale,
  }));

  // If accepted, add the driver's live position
  if (pickup?.status === "ACCEPTED" && pickup.taxi?.position) {
    taxiMarkers.push({
      id: "accepted-taxi",
      lat: pickup.taxi.position.lat,
      lng: pickup.taxi.position.lng,
      heading: pickup.taxi.position.heading,
      plate: pickup.taxi.plate,
      stale: pickup.taxi.position.stale,
    });
  }

  return (
    <div className="flex flex-col gap-5 p-4 max-w-2xl mx-auto w-full">
      <LocationConsentSheet />

      <header>
        <h1 className="font-display text-2xl font-bold text-ink">
          {t("pickup.title", "Request a Pickup")}
        </h1>
        <p className="text-sm text-muted">
          {t("pickup.subtitle", "Get picked up by an available taxi nearby")}
        </p>
      </header>

      {/* STATE: ACCEPTED / ARRIVED */}
      {isLive && pickup.status === "ACCEPTED" && (
        <div className="rounded-2xl border-2 border-taxi bg-taxi/10 p-5 shadow-sm flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-display text-lg font-bold text-ink">
              <span className="size-3 rounded-full bg-emerald-500 animate-pulse" />
              {t("pickup.driverAccepted", "Driver is on the way!")}
            </span>
            {pickup.taxi?.etaMinutes !== null && pickup.taxi?.etaMinutes !== undefined && (
              <span className="rounded-full bg-taxi px-3 py-1 text-xs font-bold text-ink">
                ETA ~{pickup.taxi.etaMinutes} min
              </span>
            )}
          </div>

          <div className="flex items-center justify-between bg-card p-3 rounded-xl border border-line">
            <div>
              <p className="font-mono text-base font-bold uppercase">{pickup.taxi?.plate ?? "TAXI"}</p>
              <p className="text-xs text-muted">{pickup.taxi?.driverFirstName ?? "Driver"}</p>
            </div>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
              {pickup.status}
            </span>
          </div>

          <div className="h-56 w-full rounded-xl overflow-hidden border border-line">
            <LazyMap
              center={[pickup.taxi?.position?.lat ?? currentLat, pickup.taxi?.position?.lng ?? currentLng]}
              zoom={15}
              taxiMarkers={taxiMarkers}
              passengerPin={pin ?? undefined}
              className="h-full w-full"
            />
          </div>

          <Button variant="danger" onClick={handleCancelPickup} loading={cancelling} fullWidth>
            {t("pickup.cancel", "Cancel Request")}
          </Button>
        </div>
      )}

      {/* STATE: SEARCHING (OPEN) */}
      {isLive && pickup.status === "OPEN" && (
        <div className="rounded-2xl border border-line bg-card p-6 shadow-sm flex flex-col items-center text-center gap-4">
          <div className="relative flex size-20 items-center justify-center">
            <span className="absolute inline-flex size-full rounded-full bg-taxi/30 animate-ping" />
            <span className="relative flex size-14 items-center justify-center rounded-full bg-taxi text-ink">
              <Icon name="car" className="size-7" />
            </span>
          </div>

          <div>
            <h2 className="font-display text-xl font-bold text-ink">
              {t("pickup.searching", "Finding nearby drivers")}
            </h2>
            <p className="text-sm text-muted mt-1">
              {t("pickup.notified", "Looking for drivers within 3 km...")}
            </p>
          </div>

          <div className="h-44 w-full rounded-xl overflow-hidden border border-line">
            <LazyMap
              center={[currentLat, currentLng]}
              zoom={14}
              taxiMarkers={taxiMarkers}
              passengerPin={pin ?? { lat: currentLat, lng: currentLng }}
              className="h-full w-full"
            />
          </div>

          <Button variant="secondary" onClick={handleCancelPickup} loading={cancelling} fullWidth>
            {t("pickup.cancel", "Cancel Request")}
          </Button>
        </div>
      )}

      {/* STATE: IDLE / FORM */}
      {!isLive && (
        <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-muted">
              {t("pickup.chooseLocation", "Pickup Location (Tap to set pin)")}
            </label>
            <button
              type="button"
              onClick={handleUseMyLocation}
              className="inline-flex items-center gap-1 text-xs font-bold text-cobalt hover:underline"
            >
              <Icon name="mapPin" className="size-3.5" />
              {t("pickup.useMyLocation", "Use my location")}
            </button>
          </div>

          <div className="h-56 w-full rounded-xl overflow-hidden border border-line relative">
            <LazyMap
              center={[currentLat, currentLng]}
              zoom={14}
              taxiMarkers={taxiMarkers}
              passengerPin={pin ?? { lat: currentLat, lng: currentLng }}
              onMapClick={(lat, lng) => setPin({ lat, lng })}
              className="h-full w-full"
            />
          </div>

          {nearby && (
            <p className="text-xs text-muted flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500" />
              {nearby.taxis.length} taxis available within 3 km (positions rounded for privacy)
            </p>
          )}

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted">
              {t("pickup.seats", "Seats Needed")}
            </label>
            <div className="mt-1.5 flex gap-2">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSeats(n)}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-bold border transition ${
                    seats === n
                      ? "border-taxi bg-taxi text-ink shadow-xs"
                      : "border-line bg-background text-muted hover:text-ink"
                  }`}
                >
                  {n} {n === 1 ? "seat" : "seats"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted">
              {t("pickup.placeNote", "Instructions or Landmark (Optional)")}
            </label>
            <input
              type="text"
              value={placeNote}
              onChange={(e) => setPlaceNote(e.target.value)}
              placeholder="e.g. In front of Awetu Grand Mall, near the main gate"
              maxLength={120}
              className="mt-1.5 w-full rounded-xl border border-line bg-background p-3 text-sm text-ink focus:border-taxi focus:outline-none"
            />
          </div>

          <Button
            variant="accent"
            fullWidth
            onClick={handleCreatePickup}
            loading={requesting}
            className="mt-2"
          >
            {t("pickup.requestButton", "Find nearby taxis")}
          </Button>
        </div>
      )}
    </div>
  );
}
