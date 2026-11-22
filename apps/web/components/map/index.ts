"use client";

import dynamic from "next/dynamic";

export { TaxiMap } from "./Map";
export type { TaxiMapProps, TaxiMarkerData, StationMarkerData } from "./Map";

export const LazyMap = dynamic(() => import("./Map").then((m) => m.TaxiMap), {
  ssr: false,
});
