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
  const [query, setQuery] = useState("");
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
  const needle = query.trim().toLowerCase();
  const waiting = station.queues.reduce((sum, queue) => sum + queue.entries.length, 0);
  const taxisHere = station.taxis.filter((taxi) => taxi.status === "AT_STATION" || taxi.status === "LOADING").length;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-3xl font-bold">{stationName(station.station, lang)}</h1>
      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-[20px] bg-card p-4 shadow-card">
          <p className="text-sm text-muted">{t("station.statWaiting")}</p>
          <p className="font-display text-4xl font-bold tabular-nums">{waiting}</p>
        </article>
        <article className="rounded-[20px] bg-card p-4 shadow-card">
          <p className="text-sm text-muted">{t("station.statTaxis")}</p>
          <p className="font-display text-4xl font-bold tabular-nums">{taxisHere}</p>
        </article>
        <article className="rounded-[20px] bg-card p-4 shadow-card">
          <p className="text-sm text-muted">{t("station.statLines")}</p>
          <p className="font-display text-4xl font-bold tabular-nums">{station.queues.length}</p>
        </article>
      </section>
      <label className="flex max-w-xl flex-col gap-1.5">
        <span className="text-sm font-semibold">{t("station.searchLabel")}</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("station.searchPlaceholder")}
          className="min-h-12 rounded-[14px] border-2 border-line bg-card px-4 focus:outline-none focus-visible:ring-4 focus-visible:ring-taxi"
        />
      </label>
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
            {(() => {
              const people = queue.entries.filter((entry) => entry.firstName.toLowerCase().includes(needle));
              if (queue.entries.length > 0 && people.length === 0) return <EmptyState title={t("station.noMatch")} />;
              if (people.length === 0) return null;
              return (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-line text-sm text-muted">
                        <th className="py-2 pr-3 font-semibold">{t("station.colPlace")}</th>
                        <th className="py-2 pr-3 font-semibold">{t("station.colPassenger")}</th>
                        <th className="py-2 pr-3 font-semibold">{t("station.colStatus")}</th>
                        <th className="py-2 pr-3 font-semibold">{t("station.colJoined")}</th>
                        <th className="py-2 font-semibold"><span className="sr-only">{t("station.remove")}</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {people.map((entry, index) => (
                        <tr key={entry.id} className="border-b border-line align-top last:border-0">
                          <td className="py-3 pr-3 font-semibold tabular-nums">{entry.position ?? index + 1}</td>
                          <td className="py-3 pr-3 font-semibold">
                            {entry.firstName}
                            {entry.isPriority && <span className="ml-2"><StatusBadge status="PRIORITY" /></span>}
                          </td>
                          <td className="py-3 pr-3"><StatusBadge status={entry.status} /></td>
                          <td className="py-3 pr-3 text-muted"><RelativeTime date={entry.joinedAt} /></td>
                          <td className="py-3">
                            {pending === entry.id ? (
                              <div className="flex min-w-56 flex-col gap-2">
                                <label className="flex flex-col gap-1 text-sm font-semibold">
                                  {t("station.reason")}
                                  <input
                                    value={reason}
                                    onChange={(event) => setReason(event.target.value)}
                                    className="min-h-12 rounded-[14px] border-2 border-line px-3 font-normal focus:outline-none focus-visible:ring-4 focus-visible:ring-taxi"
                                  />
                                </label>
                                <Button variant="danger" loading={busy} disabled={reason.trim().length < 3} onClick={() => void remove(entry.id)}>
                                  {t("station.confirm")}
                                </Button>
                              </div>
                            ) : (
                              <Button variant="danger" onClick={() => setPending(entry.id)}>{t("station.remove")}</Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </section>
        ))}
      </div>
    </div>
  );
}
