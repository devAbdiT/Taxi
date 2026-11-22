"use client";

import { EmptyState } from "@/components/States";
import { StatusBadge } from "@/components/StatusBadge";
import { routeName } from "@/lib/format";
import { useLanguage, useT } from "@/lib/i18n";
import type { DemandRoute } from "@/lib/types";

interface DemandBoardProps {
  routes: DemandRoute[];
  currentStationId: string | null;
}

export function DemandBoard({ routes, currentStationId }: DemandBoardProps) {
  const t = useT();
  const lang = useLanguage();
  const sorted = [...routes].sort((a, b) => b.waiting - a.waiting);

  return (
    <section aria-labelledby="demand-title" className="flex flex-col gap-3">
      <h2 id="demand-title" className="text-lg font-bold">
        {t("driver.demandTitle")}
      </h2>
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
