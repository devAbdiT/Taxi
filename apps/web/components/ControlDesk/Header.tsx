"use client";

import { useT } from "@/lib/i18n";

export interface StationHeaderCounts {
  waiting: number;
  priority: number;
  disputes: number;
  alerts: number;
}

interface HeaderProps {
  stationName: string;
  live?: boolean;
  counts: StationHeaderCounts;
}

export function ControlDeskHeader({ stationName, live = true, counts }: HeaderProps) {
  const t = useT();

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
      <div className="flex items-center gap-3">
        <h1 className="font-display text-2xl font-bold text-ink">{stationName}</h1>
        {live && (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
            <span className="size-2 rounded-full bg-emerald-600 animate-pulse" />
            {t("common.live", "Live")}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <div className="rounded-lg bg-sky/50 px-3 py-1.5 font-medium text-ink">
          <span className="text-muted">{t("station.desk.waiting", "Waiting")}:</span>{" "}
          <span className="font-bold">{counts.waiting}</span>
        </div>
        <div className="rounded-lg bg-amber-50 px-3 py-1.5 font-medium text-amber-900 border border-amber-200">
          <span className="text-amber-700">{t("station.desk.priority", "Priority")}:</span>{" "}
          <span className="font-bold">{counts.priority}</span>
        </div>
        <div className="rounded-lg bg-red-50 px-3 py-1.5 font-medium text-red-900 border border-red-200">
          <span className="text-red-700">{t("station.desk.disputes", "Disputes")}:</span>{" "}
          <span className="font-bold">{counts.disputes}</span>
        </div>
        <div className="rounded-lg bg-purple-50 px-3 py-1.5 font-medium text-purple-900 border border-purple-200">
          <span className="text-purple-700">{t("station.desk.alerts", "Alerts")}:</span>{" "}
          <span className="font-bold">{counts.alerts}</span>
        </div>
      </div>
    </header>
  );
}
