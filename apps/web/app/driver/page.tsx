"use client";

import useSWR, { useSWRConfig } from "swr";
import { ArriveSelector } from "@/components/driver/ArriveSelector";
import { DemandBoard } from "@/components/driver/DemandBoard";
import { ReturnCard } from "@/components/driver/ReturnCard";
import { StartLoading } from "@/components/driver/StartLoading";
import { TaxiCard } from "@/components/driver/TaxiCard";
import { TripPanel } from "@/components/driver/TripPanel";
import { ErrorState, LoadingState } from "@/components/States";
import { fetcher } from "@/lib/api";
import { REFRESH_MS } from "@/lib/config";
import { useSocket } from "@/lib/useSocket";
import type { DriverDemand, DriverMe } from "@/lib/types";

export default function DriverPage() {
  const { mutate } = useSWRConfig();
  const me = useSWR<DriverMe>("/driver/me", fetcher, { refreshInterval: REFRESH_MS });
  const demand = useSWR<DriverDemand>("/driver/demand", fetcher, { refreshInterval: REFRESH_MS });
  useSocket({
    onDemand: () => void mutate("/driver/demand"),
    onTrip: (payload) => {
      void mutate("/driver/me");
      void mutate(`/driver/trips/${payload.tripId}`);
    },
  });

  if (me.error && !me.data) return <ErrorState error={me.error} onRetry={() => me.mutate()} />;
  if (!me.data) return <LoadingState />;

  const { taxi, activeTrip } = me.data;
  const canArrive = !activeTrip && (taxi.status === "OFFLINE" || taxi.status === "EN_ROUTE");
  const refresh = () => Promise.all([me.mutate(), demand.mutate()]);
  const waitingOn = (routeId: string) => demand.data?.routes.find((r) => r.id === routeId)?.waiting ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <TaxiCard me={me.data} />

      {activeTrip ? (
        <TripPanel tripId={activeTrip.id} waiting={waitingOn(activeTrip.route.id)} onChanged={refresh} />
      ) : canArrive ? (
        <ArriveSelector onArrived={refresh} />
      ) : (
        taxi.currentStation &&
        demand.data && <StartLoading station={taxi.currentStation} routes={demand.data.routes} onStarted={refresh} />
      )}

      {demand.error && !demand.data ? (
        <ErrorState error={demand.error} onRetry={() => demand.mutate()} />
      ) : !demand.data ? (
        <LoadingState />
      ) : (
        <>
          {demand.data.returnSuggestion && <ReturnCard suggestion={demand.data.returnSuggestion} />}
          <DemandBoard routes={demand.data.routes} currentStationId={taxi.currentStation?.id ?? null} />
        </>
      )}
    </div>
  );
}
