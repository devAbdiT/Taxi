"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { TripTrackResponse } from "@taxiflow/shared";

export function useTaxiTrack(tripId: string | null) {
  const { data, error, isLoading } = useSWR<TripTrackResponse>(
    tripId ? `/trips/${tripId}/track` : null,
    fetcher,
    {
      refreshInterval: 5000,
    },
  );

  return {
    data: data ?? null,
    error,
    isLoading,
  };
}
