"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/Button";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { StatusBadge } from "@/components/StatusBadge";
import { RelativeTime } from "@/components/RelativeTime";
import { api, fetcher } from "@/lib/api";
import { REFRESH_MS } from "@/lib/config";
import { routeName, stationName } from "@/lib/format";
import { useLanguage, useT } from "@/lib/i18n";
import type { StationQueuesResponse } from "@/lib/types";

export default function StationPage() {
  const t = useT();
  const lang = useLanguage();
  const { data, error, mutate } = useSWR<StationQueuesResponse>("/station/queues", fetcher, {
    refreshInterval: REFRESH_MS,
  });
  const [busy, setBusy] = useState<string | null>(null);

  async function remove(id: string) {
    setBusy(id);
    try {
      await api.removeEntry(id);
      await mutate();
    } finally {
      setBusy(null);
    }
  }

  if (error && !data) return <ErrorState error={error} onRetry={() => mutate()} />;
  if (!data) return <LoadingState />;

  const people = data.routes.reduce((sum, route) => sum + route.entries.length, 0);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("station.title", { station: stationName(data.station, lang) })}</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">{t("station.taxis")}</h2>
        {data.taxis.length === 0 ? (
          <EmptyState title={t("station.noTaxis")} />
        ) : (
          <ul className="flex flex-col gap-2">
            {data.taxis.map((taxi) => (
              <li key={taxi.id} className="flex items-center justify-between gap-3 rounded-xl border-2 border-slate-200 bg-white p-3">
                <div>
                  <p className="text-lg font-bold">{taxi.plate}</p>
                  <p className="text-slate-700">{taxi.driverFirstName}</p>
                </div>
                <StatusBadge status={taxi.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {people === 0 ? (
        <EmptyState title={t("station.empty")} />
      ) : (
        data.routes.map((queue) => (
          <section key={queue.route.id} className="flex flex-col gap-2">
            <h2 className="text-lg font-bold">{routeName(queue.route, lang)}</h2>
            <ul className="flex flex-col gap-2">
              {queue.entries.map((entry) => (
                <li key={entry.id} className="flex flex-col gap-3 rounded-xl border-2 border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-semibold">{entry.position ?? "–"}</span>
                    <span className="mr-auto text-lg font-semibold">{entry.firstName}</span>
                    {entry.isPriority && <StatusBadge status="PRIORITY" />}
                    <StatusBadge status={entry.status} />
                  </div>
                  <p className="text-sm text-slate-600">
                    <RelativeTime date={entry.joinedAt} />
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() => remove(entry.id)}
                    loading={busy === entry.id}
                    disabled={!!busy}
                    fullWidth
                  >
                    {t("station.remove")}
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
