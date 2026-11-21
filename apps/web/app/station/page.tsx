"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/Button";
import { useToast } from "@/components/Providers";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { StatusBadge } from "@/components/StatusBadge";
import { RelativeTime } from "@/components/RelativeTime";
import { api, fetcher } from "@/lib/api";
import { REFRESH_MS } from "@/lib/config";
import { routeName, stationName } from "@/lib/format";
import { useLanguage, useT } from "@/lib/i18n";
import type { StationQueues } from "@/lib/types";

export default function StationPage() {
  const t = useT();
  const lang = useLanguage();
  const toast = useToast();
  const data = useSWR<StationQueues>("/station/queues", fetcher, { refreshInterval: REFRESH_MS });
  const [pending, setPending] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function remove(id: string) {
    setBusy(true);
    try {
      await api.removeEntry(id);
      toast(t("station.removed"));
      setPending(null);
      setReason("");
      await data.mutate();
    } catch (error) {
      toast(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  if (data.error && !data.data) return <ErrorState error={data.error} onRetry={() => data.mutate()} />;
  if (!data.data) return <LoadingState />;
  const station = data.data;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-3xl font-bold">{stationName(station.station, lang)}</h1>
      <section className="grid gap-3 sm:grid-cols-3">
        {station.taxis.map((taxi) => (
          <article key={taxi.id} className="rounded-[20px] bg-card p-4 shadow-card">
            <p className="font-display text-2xl font-bold">{taxi.plate}</p>
            <StatusBadge status={taxi.status} />
          </article>
        ))}
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        {station.queues.map((queue) => (
          <section key={queue.route.id} className="rounded-[20px] bg-card p-4 shadow-card">
            <h2 className="font-display text-xl font-bold">{routeName(queue.route, lang)}</h2>
            <p className="text-sm text-muted">{t("station.waiting", { n: queue.entries.length })}</p>
            {queue.entries.length === 0 && <EmptyState title={t("station.empty")} />}
            <ol className="mt-3 flex flex-col gap-2">
              {queue.entries.map((entry, index) => (
                <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] bg-cream p-3">
                  <div>
                    <p className="font-semibold">{entry.position ?? index + 1}. {entry.firstName}</p>
                    <p className="text-sm text-muted"><RelativeTime date={entry.joinedAt} /></p>
                  </div>
                  <div className="flex items-center gap-2">
                    {entry.isPriority && <StatusBadge status="PRIORITY" />}
                    <StatusBadge status={entry.status} />
                    {pending === entry.id ? (
                      <div className="flex flex-col gap-2">
                        <input
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                          placeholder={t("station.reason")}
                          className="min-h-12 rounded-[14px] border border-line px-3"
                        />
                        <Button variant="danger" loading={busy} disabled={reason.trim().length < 3} onClick={() => void remove(entry.id)}>
                          {t("station.confirm")}
                        </Button>
                      </div>
                    ) : (
                      <Button variant="danger" onClick={() => setPending(entry.id)}>{t("station.remove")}</Button>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
