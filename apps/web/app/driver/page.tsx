"use client";

import useSWR from "swr";
import { ArriveSelector } from "@/components/driver/ArriveSelector";
import { DemandBoard } from "@/components/driver/DemandBoard";
import { ReturnCard } from "@/components/driver/ReturnCard";
import { StartLoading } from "@/components/driver/StartLoading";
import { TaxiCard } from "@/components/driver/TaxiCard";
import { TripPanel } from "@/components/driver/TripPanel";
import { ErrorState, LoadingState } from "@/components/States";
import { fetcher } from "@/lib/api";
import { REFRESH_MS } from "@/lib/config";
import type { DriverDemandResponse, DriverMeResponse } from "@/lib/types";

export default function DriverPage() {
  const me = useSWR<DriverMeResponse>("/driver/me", fetcher, { refreshInterval: REFRESH_MS });
  const demand = useSWR<DriverDemandResponse>("/driver/demand", fetcher, { refreshInterval: REFRESH_MS });

  if (me.error && !me.data) return <ErrorState error={me.error} onRetry={() => me.mutate()} />;
  if (!me.data) return <LoadingState />;

  const { taxi, activeTrip } = me.data;
  const canArrive = !activeTrip && (taxi.status === "OFFLINE" || taxi.status === "EN_ROUTE");
  const refresh = () => Promise.all([me.mutate(), demand.mutate()]);
  const waitingOn = (routeId: string) => demand.data?.routes.find((route) => route.id === routeId)?.waiting ?? 0;

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
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
      </div>

      <div className="flex flex-col gap-5">
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
    </div>
  );
}
