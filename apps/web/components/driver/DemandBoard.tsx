"use client";

import { EmptyState } from "@/components/States";
import { StatusBadge } from "@/components/StatusBadge";
import { routeName } from "@/lib/format";
import { useLanguage, useT } from "@/lib/i18n";
import type { DemandRoute, DriverCorridor, ShortageRecommendation } from "@/lib/types";
import { CorridorSelectorModal } from "./CorridorSelectorModal";

interface DemandBoardProps {
  routes: DemandRoute[];
  currentStationId: string | null;
  shortageRecommendation?: ShortageRecommendation | null;
  assignedCorridor?: DriverCorridor | null;
  onCorridorChanged?: () => Promise<unknown> | void;
}

export function DemandBoard({
  routes,
  currentStationId,
  shortageRecommendation,
  assignedCorridor,
  onCorridorChanged,
}: DemandBoardProps) {
  const t = useT();
  const lang = useLanguage();
  const sorted = [...routes].sort((a, b) => b.waiting - a.waiting);

  return (
    <section aria-labelledby="demand-title" className="flex flex-col gap-4">
      {/* Corridor Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div className="flex flex-col gap-0.5">
          <h2 id="demand-title" className="text-lg font-bold">
            {assignedCorridor ? t("driver.corridorRoutes", { n: routes.length }) : t("driver.demandTitle")}
          </h2>
          {assignedCorridor && (
            <p className="text-xs font-medium text-muted">
              {t("driver.assignedCorridor", { corridor: assignedCorridor.name })}
            </p>
          )}
        </div>
        <CorridorSelectorModal currentCorridor={assignedCorridor} onSelect={onCorridorChanged} />
      </div>

      {/* AI Task Shortage Recommendation Alert */}
      {shortageRecommendation?.hasShortage && (
        <div className="rounded-[20px] border-2 border-amber-300 bg-amber-50/90 p-4 shadow-card flex flex-col gap-3 dark:border-amber-600 dark:bg-amber-950/30">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-amber-200 text-amber-950 font-bold text-sm">
                ⚠️
              </span>
              <h3 className="text-sm font-bold text-amber-950 dark:text-amber-100">
                {t("driver.shortageTitle")}
              </h3>
            </div>
            <div className="flex items-center gap-1.5" title={t("driver.shortageTooltip")}>
              <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-[11px] font-bold text-amber-900">
                ⚡ {shortageRecommendation.method === "llm" ? t("driver.estimateGemini") : t("driver.estimateRules")}
              </span>
              {shortageRecommendation.synthetic && (
                <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] text-muted">
                  {t("ai.demoData", "Demo data")}
                </span>
              )}
            </div>
          </div>

          <p className="text-sm font-medium leading-relaxed text-amber-950 dark:text-amber-100">
            {shortageRecommendation.message}
          </p>

          {shortageRecommendation.suggestedStation && (
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200 dark:border-amber-800">
              <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                {t("driver.recommendedStation")}:
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-200 px-3 py-1 text-xs font-bold text-amber-950">
                📍 {shortageRecommendation.suggestedStation.name}
                <span className="ml-1 rounded-full bg-amber-900 px-1.5 py-0.5 text-[10px] font-bold text-amber-50">
                  {shortageRecommendation.suggestedStation.waitingCount} {t("driver.waiting")}
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Driver's Assigned Corridor Waiting System */}
      {sorted.length === 0 ? (
        <EmptyState title={t("passenger.noRoutes")} />
      ) : (
        <ol className="grid gap-3 xl:grid-cols-2">
          {sorted.map((route) => {
            const fromHere = route.origin.id === currentStationId;
            const { waiting, priorityWaiting } = route;
            return (
              <li
                key={route.id}
                className={`flex items-center gap-4 rounded-[20px] border-2 bg-card p-4 shadow-card ${
                  fromHere ? "border-go ring-2 ring-go" : "border-line"
                }`}
              >
                <div className="flex w-16 shrink-0 flex-col items-center">
                  <span className="text-3xl font-bold leading-none tabular-nums">{waiting}</span>
                  <span className="text-xs text-muted">{t("driver.waiting")}</span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <p className="text-lg font-semibold leading-tight">{routeName(route, lang)}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {fromHere && (
                      <span className="rounded-full bg-go px-3 py-1 text-sm font-semibold text-white">
                        {t("driver.fromYourStation")}
                      </span>
                    )}
                    {priorityWaiting > 0 && (
                      <span className="flex items-center gap-1.5 text-sm">
                        <StatusBadge status="PRIORITY" />
                        {t("passenger.priorityWaiting", { n: priorityWaiting })}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
