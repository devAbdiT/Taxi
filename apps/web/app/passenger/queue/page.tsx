"use client";

import useSWR from "swr";
import { ButtonLink } from "@/components/Button";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { StatusBadge } from "@/components/StatusBadge";
import { fetcher } from "@/lib/api";
import { REFRESH_MS } from "@/lib/config";
import { routeName } from "@/lib/format";
import { useLanguage, useT } from "@/lib/i18n";
import { useRelativeTime } from "@/lib/time";
import type { MyQueue } from "@/lib/types";

export default function PassengerQueuePage() {
  const t = useT();
  const lang = useLanguage();
  const relative = useRelativeTime();
  const { data, error, mutate } = useSWR<MyQueue>("/queue/me", fetcher, { refreshInterval: REFRESH_MS });

  if (error && !data) return <ErrorState error={error} onRetry={() => mutate()} />;
  if (!data) return <LoadingState />;

  const { entry, route, position, taxiPlate } = data;
  if (!entry || !route) {
    return (
      <EmptyState
        title={t("queue.notInQueue")}
        action={<ButtonLink href="/passenger">{t("queue.findRoute")}</ButtonLink>}
      />
    );
  }

  return (
    <section className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">{t("queue.title")}</h1>
      <p className="text-lg font-semibold">{routeName(route, lang)}</p>

      <div className="flex flex-wrap gap-2">
        <StatusBadge status={entry.status} />
        {entry.isPriority && <StatusBadge status="PRIORITY" />}
      </div>

      {entry.status === "CALLED" && taxiPlate ? (
        <p role="status" className="rounded-2xl border-2 border-blue-500 bg-blue-50 p-4 text-xl font-bold text-blue-950">
          {t("queue.boardNow", { plate: taxiPlate })}
        </p>
      ) : (
        <div className="flex flex-col items-center gap-1 rounded-2xl border-2 border-slate-200 bg-white py-8">
          <p className="text-lg text-slate-700">{t("queue.position")}</p>
          <p className="text-7xl font-bold tabular-nums text-emerald-800">{position}</p>
        </div>
      )}

      <p className="text-slate-700">{t("queue.joined", { time: relative(entry.joinedAt) })}</p>
    </section>
  );
}
