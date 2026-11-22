"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { LazyMap, type TaxiMarkerData } from "@/components/map";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useWakeLock } from "@/hooks/useWakeLock";
import { LocationConsentSheet } from "@/components/LocationConsentSheet";
import { useToast } from "@/components/Providers";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { NearbyPickupsResponse, DriverMyPickupResponse } from "@/lib/types";

export function DriverGpsPanel() {
  const t = useT();
  const toast = useToast();
  const geo = useGeolocation();
  const wakeLock = useWakeLock();

  const [sharing, setSharing] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  // Poll driver's current accepted pickup if any
  const { data: myPickup, mutate: mutateMyPickup } = useSWR<DriverMyPickupResponse>(
    "/driver/pickups/mine",
    () => api.driverMyPickup(),
    { refreshInterval: 3000 }
  );

  // Poll nearby pickup requests
  const { data: nearbyPickups, mutate: mutateNearby } = useSWR<NearbyPickupsResponse>(
    sharing ? "/driver/pickups/nearby" : null,
    () => api.nearbyPickups(),
    { refreshInterval: 5000 }
  );

  // When sharing is on, periodically push location to backend
  useEffect(() => {
    if (!sharing || !geo.lat || !geo.lng) return;

    const interval = setInterval(async () => {
      try {
        await api.updateTaxiLocation({
          lat: geo.lat!,
          lng: geo.lng!,
          heading: undefined,
          speedKmh: undefined,
          accuracyM: geo.accuracy ?? undefined,
        });
      } catch {
        // Ignore periodic update failures
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [sharing, geo.lat, geo.lng, geo.accuracy]);

  function handleToggleSharing() {
    if (!sharing) {
      geo.startWatching();
      wakeLock.request();
      setSharing(true);
      toast("Location sharing active");
    } else {
      geo.stopWatching();
      wakeLock.release();
      setSharing(false);
      toast("Location sharing stopped");
    }
  }

  async function handleAccept(pickupId: string) {
    setAcceptingId(pickupId);
    try {
      await api.acceptPickup(pickupId);
      toast("Pickup request accepted! Exact passenger pin revealed.");
      await mutateMyPickup();
      await mutateNearby();
    } catch (err: any) {
      toast(err?.message ?? t("pickup.alreadyTaken", "This pickup was already accepted"));
    } finally {
      setAcceptingId(null);
    }
  }

  async function handleArrived(pickupId: string) {
    setActing(true);
    try {
      await api.arrivedPickup(pickupId);
      toast("Marked as arrived at passenger location");
      await mutateMyPickup();
    } catch (err: any) {
      toast(err?.message ?? t("common.error", "Action failed"));
    } finally {
      setActing(false);
    }
  }

  async function handleComplete(pickupId: string) {
    setActing(true);
    try {
      await api.completePickup(pickupId);
      toast("Pickup completed! Passenger coordinates cleared for privacy.");
      await mutateMyPickup();
      await mutateNearby();
    } catch (err: any) {
      toast(err?.message ?? t("common.error", "Action failed"));
    } finally {
      setActing(false);
    }
  }

  const active = myPickup?.pickup;
  const requests = nearbyPickups?.pickups ?? [];

  return (
    <div className="rounded-[20px] border border-line bg-card p-4 shadow-card flex flex-col gap-4">
      <LocationConsentSheet />

      {/* Sharing Toggle Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div>
          <h3 className="font-display text-base font-bold text-ink">
            {t("pickup.shareLocation", "Share My Location")}
          </h3>
          <p className="text-xs text-muted">
            {sharing ? "Broadcasting live GPS to nearby passengers" : "Enable GPS to receive on-demand pickup requests"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
              sharing
                ? "bg-emerald-100 text-emerald-800"
                : geo.state === "denied"
                ? "bg-red-100 text-red-800"
                : "bg-ink/10 text-muted"
            }`}
          >
            {sharing ? "Sharing" : geo.state === "denied" ? "Permission Denied" : "Paused"}
          </span>

          <button
            type="button"
            onClick={handleToggleSharing}
            className={`size-8 rounded-full border transition flex items-center justify-center ${
              sharing
                ? "bg-taxi text-ink border-taxi shadow-xs"
                : "bg-background text-muted border-line hover:text-ink"
            }`}
            aria-label="Toggle location sharing"
          >
            <Icon name="power" className="size-4" />
          </button>
        </div>
      </div>

      {sharing && (
        <div className="rounded-xl bg-sky/30 border border-sky p-2.5 text-xs text-muted flex items-center gap-2">
          <Icon name="info" className="size-4 text-cobalt" />
          <span>{t("pickup.keepScreenOn", "Screen wake lock active to maintain GPS connection.")}</span>
        </div>
      )}

      {/* ACTIVE ACCEPTED PICKUP */}
      {active && (
        <div className="rounded-2xl border-2 border-taxi bg-taxi/10 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="font-display text-sm font-bold text-ink flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-emerald-500 animate-pulse" />
              Active Passenger Pickup ({active.status})
            </span>
            <span className="rounded-full bg-taxi px-2 py-0.5 text-xs font-bold text-ink">
              {active.seats} {active.seats === 1 ? "passenger" : "passengers"}
            </span>
          </div>

          {active.placeNote && (
            <p className="text-xs text-ink bg-card p-2.5 rounded-xl border border-line">
              <strong>Landmark:</strong> {active.placeNote}
            </p>
          )}

          {active.lat !== null && active.lng !== null && (
            <div className="h-44 w-full rounded-xl overflow-hidden border border-line">
              <LazyMap
                center={[active.lat, active.lng]}
                zoom={16}
                passengerPin={{ lat: active.lat, lng: active.lng }}
                className="h-full w-full"
              />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {active.lat !== null && active.lng !== null && (
              <a
                href={`https://www.openstreetmap.org/directions?from=&to=${active.lat}%2C${active.lng}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-line bg-card px-4 text-xs font-bold text-ink hover:bg-sky/50 transition flex-1"
              >
                <Icon name="mapPin" className="size-3.5 text-cobalt" />
                {t("pickup.navigate", "Navigate in Maps")}
              </a>
            )}

            {active.status === "ACCEPTED" && (
              <Button
                variant="accent"
                onClick={() => handleArrived(active.id)}
                loading={acting}
                className="flex-1 text-xs py-2 min-h-10"
              >
                {t("pickup.iHaveArrived", "I've Arrived")}
              </Button>
            )}

            {active.status === "ARRIVED" && (
              <Button
                variant="primary"
                onClick={() => handleComplete(active.id)}
                loading={acting}
                className="flex-1 text-xs py-2 min-h-10"
              >
                {t("pickup.completePickup", "Complete Pickup")}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* NEARBY REQUESTS LIST */}
      {!active && sharing && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-muted uppercase tracking-wider">
              {t("pickup.nearbyRequests", "Nearby Pickup Requests")}
            </span>
            <span className="rounded-full bg-ink/10 px-2 py-0.5 font-bold text-ink">
              {requests.length} open
            </span>
          </div>

          {requests.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted bg-background rounded-xl border border-line">
              No pickup requests within 3 km right now.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="rounded-xl border border-line bg-card p-3 shadow-2xs flex flex-col gap-2 hover:border-taxi transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink">
                      ~{req.distanceKm} km away • {req.seats} {req.seats === 1 ? "seat" : "seats"}
                    </span>
                    <span className="text-[11px] text-muted">
                      Score: {Math.round(req.score * 100)}%
                    </span>
                  </div>

                  <p className="text-[11px] text-muted italic bg-sky/30 rounded-lg p-2">
                    💡 {req.why}
                  </p>

                  <Button
                    variant="accent"
                    onClick={() => handleAccept(req.id)}
                    loading={acceptingId === req.id}
                    className="text-xs py-2 min-h-9"
                  >
                    {t("pickup.accept", "Accept Request")}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
