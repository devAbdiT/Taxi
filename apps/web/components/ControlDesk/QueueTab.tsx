"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useT } from "@/lib/i18n";
import { ActionSheet, type ActionSheetTarget } from "./ActionSheet";
import type { DeskRoute, DeskEntry, ControllerActionType } from "@/lib/types";

interface QueueTabProps {
  data: {
    routes: DeskRoute[];
  };
  onActionSuccess: () => void;
}

export function QueueTab({ data, onActionSuccess }: QueueTabProps) {
  const t = useT();
  const [selectedAction, setSelectedAction] = useState<ControllerActionType | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<ActionSheetTarget | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  function triggerAction(action: ControllerActionType, entry: DeskEntry) {
    setSelectedAction(action);
    setSelectedTarget({
      name: entry.firstName,
      queueEntryId: entry.id,
    });
    setOpenMenuId(null);
  }

  const routes = data?.routes ?? [];

  if (routes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-card p-12 text-center">
        <Icon name="users" className="size-10 text-muted" />
        <h3 className="mt-3 font-display text-lg font-bold text-ink">
          {t("station.desk.noQueues", "No Active Queues")}
        </h3>
        <p className="mt-1 text-sm text-muted">
          {t("station.desk.noQueuesDesc", "Waiting passengers will appear here by route.")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {routes.map((deskRoute) => {
        const { route, waiting, priorityWaiting, entries } = deskRoute;
        return (
          <div key={route.id} className="rounded-2xl border border-line bg-card p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
              <div>
                <h2 className="font-display text-lg font-bold text-ink">
                  {route.destination.name}
                </h2>
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span>{waiting} {t("station.desk.waitingPassengers", "waiting")}</span>
                  {priorityWaiting > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
                      {priorityWaiting} {t("station.desk.priorityCount", "priority")}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {entries.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">
                {t("station.desk.queueEmpty", "Queue is currently empty.")}
              </p>
            ) : (
              <div className="mt-3 divide-y divide-line">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between py-3 gap-3 hover:bg-sky/20 px-2 rounded-xl transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink/10 text-xs font-bold text-ink">
                        {entry.position ?? "-"}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-ink">{entry.firstName}</span>
                          {entry.isPriority && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900 border border-amber-300">
                              <Icon name="star" className="size-3 text-amber-600" />
                              {entry.priorityVerified ? "Verified Priority" : "Priority"}
                            </span>
                          )}
                          {entry.assistance && entry.assistance !== "NONE" && (
                            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800">
                              {entry.assistance}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted">
                          {t("station.desk.waitingFor", "Waiting")} ~{entry.waitingMinutes} {t("common.min", "min")}
                        </span>
                      </div>
                    </div>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenMenuId(openMenuId === entry.id ? null : entry.id)}
                        className="flex size-9 items-center justify-center rounded-xl border border-line text-muted hover:text-ink hover:bg-black/5"
                        aria-label="Queue actions"
                      >
                        <Icon name="more" className="size-5" />
                      </button>

                      {openMenuId === entry.id && (
                        <div
                          className="absolute right-0 top-10 z-30 w-52 rounded-xl border border-line bg-card p-1.5 shadow-xl"
                          onMouseLeave={() => setOpenMenuId(null)}
                        >
                          <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted">
                            {t("station.action.menuTitle", "Queue Actions")}
                          </div>

                          <button
                            type="button"
                            onClick={() => triggerAction("WARN", entry)}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-sky/50"
                          >
                            <Icon name="alert" className="size-3.5 text-amber-600" />
                            {t("station.action.warn", "Warn passenger")}
                          </button>

                          <button
                            type="button"
                            onClick={() => triggerAction("MOVE_FORWARD", entry)}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-sky/50"
                          >
                            <Icon name="arrowRight" className="size-3.5 rotate-[-90deg] text-emerald-600" />
                            {t("station.action.moveForward", "Move forward")}
                          </button>

                          <button
                            type="button"
                            onClick={() => triggerAction("MOVE_BACK", entry)}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-sky/50"
                          >
                            <Icon name="arrowRight" className="size-3.5 rotate-90 text-amber-600" />
                            {t("station.action.moveBack", "Move back")}
                          </button>

                          {entry.isPriority ? (
                            <button
                              type="button"
                              onClick={() => triggerAction("REJECT_PRIORITY", entry)}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-alert hover:bg-alert/10"
                            >
                              <Icon name="x" className="size-3.5" />
                              {t("station.action.rejectPriority", "Reject priority claim")}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => triggerAction("CONFIRM_PRIORITY", entry)}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-50"
                            >
                              <Icon name="star" className="size-3.5" />
                              {t("station.action.confirmPriority", "Confirm priority")}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => triggerAction("MARK_NO_SHOW", entry)}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-sky/50"
                          >
                            <Icon name="userX" className="size-3.5 text-muted" />
                            {t("station.action.markNoShow", "Mark no-show")}
                          </button>

                          <button
                            type="button"
                            onClick={() => triggerAction("REMOVE", entry)}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-alert hover:bg-alert/10"
                          >
                            <Icon name="trash" className="size-3.5" />
                            {t("station.action.remove", "Remove from line")}
                          </button>

                          <button
                            type="button"
                            onClick={() => triggerAction("SUSPEND", entry)}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-bold text-alert hover:bg-alert/10"
                          >
                            <Icon name="alert" className="size-3.5" />
                            {t("station.action.suspend", "Suspend user")}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

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
