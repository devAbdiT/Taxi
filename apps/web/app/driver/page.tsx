"use client";

import useSWR from "swr";
import { ArriveSelector } from "@/components/driver/ArriveSelector";
import { DemandBoard } from "@/components/driver/DemandBoard";
import { ReturnCard } from "@/components/driver/ReturnCard";
import { TaxiCard } from "@/components/driver/TaxiCard";
import { ErrorState, LoadingState } from "@/components/States";
import { fetcher } from "@/lib/api";
import { REFRESH_MS } from "@/lib/config";
import type { DriverDemand, DriverMe } from "@/lib/types";

export default function DriverPage() {
  const me = useSWR<DriverMe>("/driver/me", fetcher, { refreshInterval: REFRESH_MS });
  const demand = useSWR<DriverDemand>("/driver/demand", fetcher, { refreshInterval: REFRESH_MS });

  if (me.error && !me.data) return <ErrorState error={me.error} onRetry={() => me.mutate()} />;
  if (!me.data) return <LoadingState />;

  const { taxi } = me.data;
  const canArrive = taxi.status === "OFFLINE" || taxi.status === "EN_ROUTE";
  const refresh = () => Promise.all([me.mutate(), demand.mutate()]);

  return (
    <div className="flex flex-col gap-5">
      <TaxiCard me={me.data} />

      {canArrive && <ArriveSelector onArrived={refresh} />}

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
