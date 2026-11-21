"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Button, ButtonLink } from "@/components/Button";
import { NotificationList } from "@/components/NotificationList";
import { Icon } from "@/components/Icon";
import { EmptyState, ErrorState, FormError, LoadingState } from "@/components/States";
import { StatusBadge } from "@/components/StatusBadge";
import { api, fetcher } from "@/lib/api";
import { REFRESH_MS } from "@/lib/config";
import { routeName, stationName } from "@/lib/format";
import { useLanguage, useT } from "@/lib/i18n";
import { useRelativeTime } from "@/lib/time";
import { useSocket } from "@/lib/useSocket";
import type { MyQueue } from "@/lib/types";

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
  const { data, error, mutate } = useSWR<MyQueue>(MY_QUEUE_KEY, fetcher, { refreshInterval: REFRESH_MS });
  useSocket({
    onQueue: () => void mutate(),
    onNotification: () => void mutateGlobal("/notifications"),
  });

  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<unknown>(null);

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
      <div className="flex flex-col gap-8">
        <EmptyState title={t("queue.notInQueue")} action={<ButtonLink href="/passenger">{t("queue.findRoute")}</ButtonLink>} />
        <NotificationList />
      </div>
    );
  }

  const called = entry.status === "CALLED";

  return (
    <section className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">{t("queue.title")}</h1>

      <div className="flex flex-col gap-2">
        <p className="text-lg font-semibold">{routeName(route, lang)}</p>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={entry.status} />
          {entry.isPriority && <StatusBadge status="PRIORITY" />}
        </div>
      </div>

      <div role="status" aria-live="polite">
        {called ? (
          <div className="flex flex-col gap-2 rounded-2xl border-4 border-blue-600 bg-blue-50 p-5 text-blue-950">
            <p className="flex items-start gap-3 text-2xl font-bold leading-snug">
              <Icon name="bell" className="mt-1 size-7" />
              {t("queue.boardNow", { plate: taxiPlate ?? "", station: stationName(route.origin, lang) })}
            </p>
            <p className="text-base">{t("queue.calledHint")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="flex items-start gap-2 rounded-xl border-2 border-amber-400 bg-amber-50 p-3 text-amber-950">
              <Icon name="clock" className="mt-0.5" />
              {t("queue.waitingBanner")}
            </p>
            {position !== null && (
              <div className="flex flex-col items-center gap-1 rounded-2xl border-2 border-slate-200 bg-white py-8">
                <p className="text-lg text-slate-700">{t("queue.position")}</p>
                <p className="text-8xl font-bold leading-none tabular-nums text-emerald-800">{position}</p>
                <p className="mt-2 text-lg font-semibold">{t(aheadKey(position), { n: position - 1 })}</p>
              </div>
            )}
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
        <Button variant="secondary" onClick={() => setConfirming(true)} fullWidth>
          {t("queue.leave")}
        </Button>
      )}
      <NotificationList />
    </section>
  );
}
