"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Button, ButtonLink } from "@/components/Button";
import { ProgressRing, RouteLine } from "@/components/kit";
import { RelativeTime } from "@/components/RelativeTime";
import { Icon } from "@/components/Icon";
import { EmptyState, ErrorState, FormError, LoadingState } from "@/components/States";
import { StatusBadge } from "@/components/StatusBadge";
import { api, fetcher } from "@/lib/api";
import { REFRESH_MS } from "@/lib/config";
import { routeName, stationName } from "@/lib/format";
import { useLanguage, useT } from "@/lib/i18n";
import { useRelativeTime } from "@/lib/time";
import type { MyQueueResponse, NotificationsResponse } from "@/lib/types";

const MY_QUEUE_KEY = "/queue/me";

function aheadKey(position: number) {
  if (position <= 1) return "queue.aheadNone" as const;
  if (position === 2) return "queue.aheadOne" as const;
  return "queue.aheadMany" as const;
}

export default function PassengerQueuePage() {
  const t = useT();
  const lang = useLanguage();
  const relative = useRelativeTime();
  const router = useRouter();
  const { mutate: mutateGlobal } = useSWRConfig();
  const { data, error, mutate } = useSWR<MyQueueResponse>(MY_QUEUE_KEY, fetcher, { refreshInterval: REFRESH_MS });
  const notes = useSWR<NotificationsResponse>("/notifications", fetcher, { refreshInterval: REFRESH_MS });

  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<unknown>(null);
  const calledNow = data?.entry?.status === "CALLED";

  useEffect(() => {
    if (calledNow && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(200);
  }, [calledNow]);

  async function leave() {
    setLeaving(true);
    setLeaveError(null);
    try {
      await api.leaveQueue();
      await mutate();
      void mutateGlobal("/routes");
      setConfirming(false);
      router.push("/passenger");
    } catch (err) {
      setLeaveError(err);
    } finally {
      setLeaving(false);
    }
  }

  if (error && !data) return <ErrorState error={error} onRetry={() => mutate()} />;
  if (!data) return <LoadingState />;

  const { entry, position, taxiPlate } = data;
  const route = entry?.route;
  if (!entry || !route) {
    return (
      <EmptyState
        title={t("queue.notInQueue")}
        action={<ButtonLink href="/passenger">{t("queue.findRoute")}</ButtonLink>}
      />
    );
  }

  const called = entry.status === "CALLED";
  const ahead = Math.max(0, (position ?? 1) - 1);

  return (
    <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      <div className="flex flex-col gap-5">
      <h1 className="font-display text-3xl font-bold">{t("queue.title")}</h1>

      <div className="flex flex-col gap-2">
        <p className="text-lg font-semibold">{routeName(route, lang)}</p>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={entry.status} />
          {entry.isPriority && <StatusBadge status="PRIORITY" />}
        </div>
      </div>

      <div role="status" aria-live="polite">
        {called ? (
          <div className="pulse-ring flex flex-col items-center gap-3 rounded-[24px] border-4 border-go bg-go-soft p-4 text-center text-ink sm:p-6">
            <Icon name="bell" className="size-10 text-go" />
            <p className="font-display text-4xl font-bold leading-none sm:text-5xl">{t("queue.boardNowTitle")}</p>
            <p className="sr-only">
              {t("queue.boardNow", { plate: taxiPlate ?? "", station: stationName(route.origin, lang) })}
            </p>
            <div className="w-full rounded-2xl bg-white px-3 py-3 shadow-card">
              <p className="text-sm font-semibold text-muted">{t("queue.taxiPlate")}</p>
              <p className="font-display text-4xl font-bold leading-tight tracking-wide [overflow-wrap:anywhere] sm:text-5xl">
                {taxiPlate}
              </p>
            </div>
            <p className="font-display text-2xl font-bold leading-snug [overflow-wrap:anywhere]">
              {t("queue.atStation", { station: stationName(route.origin, lang) })}
            </p>
            <p className="text-base">{t("queue.calledHint")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 rounded-[20px] bg-card p-4 shadow-card">
            <RouteLine from={stationName(route.origin, lang)} to={stationName(route.destination, lang)} />
            {position !== null && (
              <>
                <p className="text-center font-display text-2xl font-bold">{t("queue.youAre", { n: position })}</p>
                <ProgressRing value={position} label={t("queue.position")} />
              </>
            )}
            <p className="text-center text-lg font-semibold">{t(aheadKey(position ?? 1), { n: ahead })}</p>
          </div>
        )}
      </div>

      <p className="flex items-center gap-2 text-slate-700">
        <Icon name="clock" />
        {t("queue.joined", { time: relative(entry.joinedAt) })}
      </p>

      {confirming ? (
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-red-300 bg-red-50 p-4">
          <p className="text-lg font-semibold text-red-950">
            {called && taxiPlate ? t("queue.leaveConfirmCalled", { plate: taxiPlate }) : t("queue.leaveConfirm")}
          </p>
          <FormError error={leaveError} />
          <Button variant="danger" onClick={leave} loading={leaving} fullWidth>
            {t("queue.leaveYes")}
          </Button>
          <Button variant="secondary" onClick={() => setConfirming(false)} disabled={leaving} fullWidth>
            {t("queue.leaveNo")}
          </Button>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setConfirming(true)}>
          {t("queue.leave")}
        </Button>
      )}
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold">
            {t("queue.notifications")}
            {(notes.data?.unread ?? 0) > 0 && (
              <span className="ml-2 inline-flex min-h-7 min-w-7 items-center justify-center rounded-full bg-taxi px-2 text-sm text-ink">
                {notes.data?.unread}
              </span>
            )}
          </h2>
          <Button
            variant="secondary"
            onClick={() => void api.markNotificationsRead().then(() => notes.mutate())}
          >
            {t("queue.markRead")}
          </Button>
        </div>
        {(notes.data?.notifications ?? []).length === 0 ? (
          <p className="text-muted">{t("queue.noNotes")}</p>
        ) : (
          notes.data?.notifications.map((note) => (
            <article key={note.id} className="rounded-[20px] border border-line bg-card p-4">
              <p className="flex items-center gap-2 font-semibold">
                {!note.read && <span className="size-2.5 rounded-full bg-taxi" />}
                {note.title}
              </p>
              <p className="mt-1 text-sm text-muted">{note.body}</p>
              <p className="mt-1 text-sm text-muted"><RelativeTime date={note.createdAt} /></p>
            </article>
          ))
        )}
      </section>
    </section>
  );
}
