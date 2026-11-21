"use client";

import { Icon } from "@/components/Icon";
import { StatusBadge } from "@/components/StatusBadge";
import { countKey, routeName } from "@/lib/format";
import { useLanguage, useT } from "@/lib/i18n";
import type { ReturnSuggestion } from "@/lib/types";

/** The core idea of TaxiFlow: show the driver the passengers waiting for the trip back. */
export function ReturnCard({ suggestion }: { suggestion: ReturnSuggestion }) {
  const t = useT();
  const lang = useLanguage();
  const { waiting, priorityWaiting, route, reason } = suggestion;

  const title =
    reason === "RETURN_TRIP"
      ? t(countKey(waiting, "driver.returnNone", "driver.returnOne", "driver.returnMany"), { n: waiting })
      : t("driver.fromStation", { n: waiting });

  return (
    <section
      aria-live="polite"
      className="flex flex-col gap-3 rounded-2xl border-4 border-emerald-700 bg-emerald-700 p-5 text-white shadow-lg"
    >
      <p className="flex items-start gap-3 text-2xl font-bold leading-snug">
        <Icon name="arrowRight" className="mt-1 size-7 rotate-180" />
        {title}
      </p>
      <p className="text-lg font-semibold">{routeName(route, lang)}</p>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-6xl font-bold leading-none tabular-nums">{waiting}</span>
        {priorityWaiting > 0 && (
          <span className="flex items-center gap-2 rounded-full bg-white px-1 py-1 pr-3 text-slate-900">
            <StatusBadge status="PRIORITY" />
            <span className="font-semibold">{t("passenger.priorityWaiting", { n: priorityWaiting })}</span>
          </span>
        )}
      </div>
    </section>
  );
}
