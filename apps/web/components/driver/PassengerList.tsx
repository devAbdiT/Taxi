"use client";

import { Button } from "@/components/Button";
import { StatusBadge } from "@/components/StatusBadge";
import { useT } from "@/lib/i18n";
import type { QueueStatus, TripEntry } from "@/lib/types";

const order: Partial<Record<QueueStatus, number>> = { CALLED: 0, BOARDED: 1, NO_SHOW: 2 };

interface PassengerListProps {
  entries: TripEntry[];
  /** Board and No-show are only offered while the trip is loading. */
  canManage: boolean;
  busyId: string | null;
  onBoard: (entryId: string) => void;
  onNoShow: (entryId: string) => void;
}

export function PassengerList({ entries, canManage, busyId, onBoard, onNoShow }: PassengerListProps) {
  const t = useT();
  const sorted = [...entries].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-lg font-semibold">{t("driver.passengersTitle")}</h3>
      {sorted.length === 0 ? (
        <p className="text-slate-700">{t("driver.noPassengersYet")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((entry) => {
            const actionable = canManage && entry.status === "CALLED";
            return (
              <li key={entry.id} className="flex flex-col gap-3 rounded-xl border-2 border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-auto text-lg font-semibold">{entry.firstName}</span>
                  {entry.isPriority && <StatusBadge status="PRIORITY" />}
                  <StatusBadge status={entry.status} />
                </div>
                {actionable && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => onBoard(entry.id)} loading={busyId === `board:${entry.id}`} disabled={!!busyId}>
                      {t("driver.board")}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => onNoShow(entry.id)}
                      loading={busyId === `noshow:${entry.id}`}
                      disabled={!!busyId}
                    >
                      {t("driver.noShow")}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
