"use client";

import useSWR from "swr";
import { Icon } from "@/components/Icon";
import { useT } from "@/lib/i18n";
import { api } from "@/lib/api";
import type { DemandForecastResponse } from "@/lib/types";

interface DriverForecastCardProps {
  stationId: string | null;
}

export function DriverForecastCard({ stationId }: DriverForecastCardProps) {
  const t = useT();

  const { data: forecast } = useSWR<DemandForecastResponse>(
    stationId ? `/ai/demand-forecast?stationId=${stationId}` : null,
    () => api.demandForecast(stationId!),
    { refreshInterval: 60000 }
  );

  if (!forecast || !forecast.recommendation) return null;

  const rec = forecast.recommendation;
  // Next 3 hours data from top route or recommendation
  const targetRoute = forecast.routes.find((r) => r.route.id === rec.routeId) ?? forecast.routes[0];
  const hours = targetRoute?.hours ?? [];
  const maxVal = Math.max(...hours.map((h) => h.expectedWaiting), 15);

  return (
    <div className="rounded-[20px] border border-line bg-card p-4 shadow-card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-taxi/30 text-ink">
            <Icon name="star" className="size-4 text-ink" />
          </span>
          <h3 className="font-display text-sm font-bold text-ink">
            {t("ai.smartSuggestion", "Smart Dispatch Suggestion")}
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-taxi/30 px-2 py-0.5 text-[10px] font-bold text-ink">
            ⚡ {t("ai.estimateBadge", "Estimate")}
          </span>
          {forecast.synthetic && (
            <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] text-muted">
              {t("ai.demoData", "Demo data")}
            </span>
          )}
        </div>
      </div>

      <p className="text-sm font-medium text-ink bg-sky/30 rounded-xl p-3 border border-sky">
        💡 {rec.message}
      </p>

      {/* Mini hourly bar chart (inline SVG) */}
      {hours.length > 0 && (
        <div>
          <div className="text-[11px] font-bold text-muted uppercase tracking-wider mb-2">
            Expected Waiting (Next 3 Hours)
          </div>
          <div className="flex items-end justify-around gap-2 h-20 pt-2 px-2 bg-background rounded-xl border border-line">
            {hours.map((pt, i) => {
              const heightPercent = Math.round((pt.expectedWaiting / maxVal) * 100);
              const label = i === 0 ? "Now" : `+${i}h`;
              return (
                <div key={pt.hourStart} className="flex flex-col items-center gap-1 flex-1 h-full justify-end">
                  <span className="text-[10px] font-bold text-ink">{Math.round(pt.expectedWaiting)}</span>
                  <div
                    style={{ height: `${Math.max(15, heightPercent)}%` }}
                    className="w-full max-w-[28px] rounded-t-md bg-taxi transition-all"
                    aria-label={`Hour ${label}: ${Math.round(pt.expectedWaiting)} passengers`}
                  />
                  <span className="text-[10px] text-muted font-medium">{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
