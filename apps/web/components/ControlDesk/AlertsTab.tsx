"use client";

import { Icon } from "@/components/Icon";
import { useT } from "@/lib/i18n";
import type { FairnessAlert } from "@/lib/types";

interface AlertsTabProps {
  data: FairnessAlert[];
  onTakeAction?: (target: { kind: string; id: string } | null) => void;
}

export function AlertsTab({ data, onTakeAction }: AlertsTabProps) {
  const t = useT();
  const alerts = data ?? [];

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-card p-12 text-center">
        <Icon name="checkCircle" className="size-10 text-emerald-500" />
        <h3 className="mt-3 font-display text-lg font-bold text-ink">
          {t("station.alerts.empty", "No Fairness Alerts")}
        </h3>
        <p className="mt-1 text-sm text-muted">
          {t("station.alerts.emptyDesc", "All queues, priorities, and driver turns operate normally.")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {alerts.map((alert) => {
        const isWarning = alert.severity === "warning";
        return (
          <div
            key={alert.id}
            className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 shadow-xs transition ${
              isWarning
                ? "border-amber-300 bg-amber-50/70 text-amber-950"
                : "border-sky bg-sky/30 text-ink"
            }`}
          >
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${
                isWarning ? "bg-amber-200 text-amber-900" : "bg-sky text-ink"
              }`}>
                <Icon name={isWarning ? "alert" : "info"} className="size-4" />
              </span>

              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${
                    isWarning ? "text-amber-800" : "text-muted"
                  }`}>
                    {alert.type.replace(/_/g, " ")}
                  </span>
                  <span className={`rounded-full px-2 py-0.2 text-[10px] font-bold ${
                    isWarning ? "bg-amber-200 text-amber-900" : "bg-black/10 text-ink"
                  }`}>
                    {alert.severity}
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium leading-snug">
                  {alert.message}
                </p>
              </div>
            </div>

            {alert.target && onTakeAction && (
              <button
                type="button"
                onClick={() => onTakeAction(alert.target)}
                className="rounded-xl border border-line bg-card px-3.5 py-1.5 text-xs font-semibold text-ink shadow-xs hover:border-taxi hover:bg-taxi/20 transition"
              >
                {t("station.alerts.takeAction", "Take Action")}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
