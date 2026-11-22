"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useT } from "@/lib/i18n";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionSheet, type ActionSheetTarget } from "./ActionSheet";
import type { DriverLineEntry, ControllerActionType } from "@/lib/types";

interface DriverLineTabProps {
  data: DriverLineEntry[];
  onActionSuccess: () => void;
}

export function DriverLineTab({ data, onActionSuccess }: DriverLineTabProps) {
  const t = useT();
  const [selectedAction, setSelectedAction] = useState<ControllerActionType | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<ActionSheetTarget | null>(null);

  const entries = data ?? [];

  function triggerAction(action: ControllerActionType, entry: DriverLineEntry) {
    setSelectedAction(action);
    setSelectedTarget({
      name: `${entry.driverFirstName} (${entry.plate})`,
      driverQueueEntryId: entry.id,
    });
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-card p-12 text-center">
        <Icon name="car" className="size-10 text-muted" />
        <h3 className="mt-3 font-display text-lg font-bold text-ink">
          {t("station.driverLine.empty", "No Drivers Waiting")}
        </h3>
        <p className="mt-1 text-sm text-muted">
          {t("station.driverLine.emptyDesc", "Taxis at this station will appear in their turn order.")}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-xs">
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div>
          <h2 className="font-display text-lg font-bold text-ink">
            {t("station.driverLine.title", "Driver Turn Order")}
          </h2>
          <p className="text-xs text-muted">
            {t("station.driverLine.desc", "Turn order is strictly enforced. First in line starts next.")}
          </p>
        </div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
          {entries.length} {t("station.driverLine.count", "Taxis")}
        </span>
      </div>

      <div className="mt-4 divide-y divide-line">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex flex-wrap items-center justify-between gap-3 py-3 px-2 hover:bg-sky/20 rounded-xl transition"
          >
            <div className="flex items-center gap-3">
              <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                entry.position === 1 ? "bg-taxi text-ink font-extrabold shadow-xs" : "bg-ink/10 text-ink"
              }`}>
                {entry.position ?? "-"}
              </span>

              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-ink">{entry.plate}</span>
                  <span className="text-sm font-medium text-muted">— {entry.driverFirstName}</span>
                  {entry.outOfTurnAllowed && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900 border border-amber-300">
                      ★ {t("station.driverLine.outOfTurnGranted", "Out-of-turn Allowed")}
                    </span>
                  )}
                </div>
                <div className="mt-0.5">
                  <StatusBadge status={entry.status as any} />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => triggerAction("ALLOW_OUT_OF_TURN", entry)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-card px-3 py-1.5 text-xs font-semibold text-ink hover:border-taxi hover:bg-taxi/20 transition"
              >
                <Icon name="star" className="size-3.5 text-taxi" />
                {t("station.driverLine.allowOutOfTurn", "Allow Out of Turn")}
              </button>

              <button
                type="button"
                onClick={() => triggerAction("REORDER_DRIVER", entry)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-card px-3 py-1.5 text-xs font-semibold text-ink hover:bg-sky/50 transition"
              >
                <Icon name="arrowRight" className="size-3.5 rotate-90 text-muted" />
                {t("station.driverLine.reorder", "Reorder")}
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedAction && selectedTarget && (
        <ActionSheet
          open={Boolean(selectedAction)}
          action={selectedAction}
          target={selectedTarget}
          onClose={() => {
            setSelectedAction(null);
            setSelectedTarget(null);
          }}
          onSuccess={onActionSuccess}
        />
      )}
    </div>
  );
}
