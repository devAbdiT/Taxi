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
import { LazyMap } from "@/components/map";
import { useToast } from "@/components/Providers";
import { api, fetcher } from "@/lib/api";
import { REFRESH_MS } from "@/lib/config";
import { routeName, stationName } from "@/lib/format";
import { useLanguage, useT } from "@/lib/i18n";
import { useRelativeTime } from "@/lib/time";
import type { MyQueueResponse, NotificationsResponse, TripTrackResponse, WaitEstimateResponse } from "@/lib/types";

const MY_QUEUE_KEY = "/queue/me";

function aheadKey(position: number) {
  if (position <= 1) return "queue.aheadNone" as const;
  if (position === 2) return "queue.aheadOne" as const;
  return "queue.aheadMany" as const;
}

export default function PassengerQueuePage() {
  const t = useT();
  const lang = useLanguage();
  const toast = useToast();
  const relative = useRelativeTime();
  const router = useRouter();
  const { mutate: mutateGlobal } = useSWRConfig();
  const { data, error, mutate } = useSWR<MyQueueResponse>(MY_QUEUE_KEY, fetcher, { refreshInterval: REFRESH_MS });
  const notes = useSWR<NotificationsResponse>("/notifications", fetcher, { refreshInterval: REFRESH_MS });

  // AI wait estimate
  const routeId = data?.entry?.route?.id;
  const { data: waitEstimate } = useSWR<WaitEstimateResponse>(
    routeId ? `/ai/wait-estimate?routeId=${routeId}` : null,
    () => api.waitEstimate(routeId!),
    { refreshInterval: 60000 }
  );

  // Live GPS tracking when trip is active / called
  const tripId = data?.entry?.tripId ?? null;
  const { data: trackData } = useSWR<TripTrackResponse>(
    tripId ? `/trips/${tripId}/track` : null,
    () => api.tripTrack(tripId!),
    { refreshInterval: 5000 }
  );

  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<unknown>(null);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeType, setDisputeType] = useState<string>("LINE_JUMPING");
  const [disputeDesc, setDisputeDesc] = useState("");
  const [submittingDispute, setSubmittingDispute] = useState(false);

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

  async function handleFileDispute(e: React.FormEvent) {
    e.preventDefault();
    if (disputeDesc.trim().length < 10) return;
    setSubmittingDispute(true);
    try {
      await api.createDispute({
        type: disputeType as any,
        description: disputeDesc.trim(),
        queueEntryId: data?.entry?.id,
      });
      toast(t("dispute.submitted", "Problem reported to station queue controller"));
      setShowDisputeModal(false);
      setDisputeDesc("");
    } catch (err: any) {
      toast(err?.message ?? t("common.error", "Could not submit report"));
    } finally {
      setSubmittingDispute(false);
    }
  }

  if (error && !data) return <ErrorState error={error} onRetry={() => mutate()} />;
  if (!data) return <LoadingState />;

  if (!data.entry) {
    return (
      <EmptyState
        title={t("queue.notInQueue")}
        action={<ButtonLink href="/passenger">{t("queue.joinOther")}</ButtonLink>}
      />
    );
  }

  const { entry, position, taxiPlate } = data;
  const route = entry.route;
  const ahead = position !== null ? Math.max(0, position - 1) : 0;
  const called = entry.status === "CALLED";

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-3xl font-bold">{routeName(route, lang)}</h1>
          <div className="flex items-center gap-2">
            <StatusBadge status={entry.status} />
            {entry.isPriority && <StatusBadge status="PRIORITY" />}
          </div>
        </header>

        {called ? (
          <div className="flex flex-col gap-3 rounded-[24px] bg-taxi/20 p-5 border-2 border-taxi shadow-card">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-emerald-600 animate-pulse" />
              <p className="font-mono text-xl font-bold uppercase">{taxiPlate ?? t("queue.taxiArrived")}</p>
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

            {/* AI Wait Estimate Badge & Prediction */}
            {waitEstimate && (
              <div className="mt-2 rounded-2xl border border-line bg-sky/30 p-3.5 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-taxi/30 px-2 py-0.5 text-xs font-bold text-ink">
                      ⚡ {t("ai.estimateBadge", "Estimate")}
                    </span>
                    {waitEstimate.synthetic && (
                      <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] text-muted">
                        {t("ai.demoData", "Demo data")}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-medium text-muted">
                    {waitEstimate.confidence === "high"
                      ? t("ai.confidenceHigh", "High confidence")
                      : waitEstimate.confidence === "medium"
                      ? t("ai.confidenceMedium", "Medium confidence")
                      : t("ai.confidenceLow", "Low confidence")}
                  </span>
                </div>
                <p className="font-display text-base font-bold text-ink">
                  {t("ai.waitMinutes", {
                    minutes: waitEstimate.minutes,
                    low: waitEstimate.lowMinutes,
                    high: waitEstimate.highMinutes,
                  })}
                </p>
                <p className="text-[11px] text-muted" title={waitEstimate.basis}>
                  {t("ai.waitBasis", { samples: waitEstimate.basedOnSamples })} ({waitEstimate.basis.replace(/_/g, " ")})
                </p>
              </div>
            )}
          </div>
        )}

        {/* Live Taxi Map when taxi assigned/called */}
        {(called || trackData?.taxi) && (
          <div className="rounded-[20px] border border-line bg-card p-4 shadow-card flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-ink flex items-center gap-2">
                <Icon name="car" className="size-4 text-taxi" />
                {t("track.title", "Track approaching taxi")}
              </h3>
              {trackData?.etaMinutes !== null && trackData?.etaMinutes !== undefined && (
                <span className="rounded-full bg-taxi/20 px-2.5 py-0.5 text-xs font-bold text-ink">
                  ETA ~{trackData.etaMinutes} {t("common.min", "min")}
                </span>
              )}
            </div>

            <div className="h-44 w-full rounded-xl overflow-hidden border border-line">
              <LazyMap
                center={[trackData?.taxi?.lat ?? 7.6686, trackData?.taxi?.lng ?? 36.8313]}
                zoom={15}
                taxiMarkers={
                  trackData?.taxi
                    ? [
                        {
                          id: "my-taxi",
                          lat: trackData.taxi.lat,
                          lng: trackData.taxi.lng,
                          heading: trackData.taxi.heading,
                          plate: trackData.taxiPlate,
                          stale: trackData.taxi.stale,
                        },
                      ]
                    : []
                }
                polyline={trackData?.polyline}
                className="h-full w-full"
              />
            </div>
            {trackData?.taxi?.stale && (
              <p className="text-[11px] text-muted italic">
                {t("track.staleNotice", "Taxi GPS signal paused; showing last reported location.")}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 text-sm">
          <p className="flex items-center gap-2 text-muted">
            <Icon name="clock" />
            {t("queue.joined", { time: relative(entry.joinedAt) })}
          </p>
          <button
            type="button"
            onClick={() => setShowDisputeModal(true)}
            className="text-xs font-semibold text-alert hover:underline flex items-center gap-1"
          >
            <Icon name="alert" className="size-3.5" />
            {t("dispute.reportProblem", "Report line problem")}
          </button>
        </div>

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

      {/* Notifications list */}
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

      {/* Report problem / Dispute modal */}
      {showDisputeModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-line bg-card p-6 shadow-2xl">
            <h3 className="font-display text-lg font-bold text-ink">
              {t("dispute.modalTitle", "Report a problem with the line")}
            </h3>
            <p className="mt-1 text-xs text-muted">
              {t("dispute.modalDesc", "Queue controllers review every report. State what happened clearly.")}
            </p>

            <form onSubmit={handleFileDispute} className="mt-4 flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-muted uppercase tracking-wider">
                  {t("dispute.typeLabel", "Issue Type")}
                </label>
                <select
                  value={disputeType}
                  onChange={(e) => setDisputeType(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-line bg-background p-2.5 text-sm text-ink focus:border-taxi focus:outline-none"
                >
                  <option value="LINE_JUMPING">Line Jumping / Cutting</option>
                  <option value="PRIORITY_CLAIM">Unverified Priority Claim</option>
                  <option value="DRIVER_SKIPPED_TURN">Driver Skipped Turn</option>
                  <option value="FARE_DISPUTE">Fare Dispute</option>
                  <option value="BEHAVIOR">Disruptive Behavior</option>
                  <option value="OTHER">Other Issue</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted uppercase tracking-wider">
                  {t("dispute.descLabel", "Description (10–500 chars)")} *
                </label>
                <textarea
                  value={disputeDesc}
                  onChange={(e) => setDisputeDesc(e.target.value)}
                  placeholder={t("dispute.descPlaceholder", "Explain what happened in detail...")}
                  rows={3}
                  required
                  minLength={10}
                  maxLength={500}
                  className="mt-1 w-full rounded-xl border border-line bg-background p-2.5 text-sm text-ink focus:border-taxi focus:outline-none"
                />
              </div>

              <div className="mt-2 flex gap-2">
                <Button
                  type="submit"
                  variant="accent"
                  fullWidth
                  loading={submittingDispute}
                  disabled={disputeDesc.trim().length < 10}
                >
                  {t("dispute.submit", "Submit Report")}
                </Button>
                <button
                  type="button"
                  onClick={() => setShowDisputeModal(false)}
                  disabled={submittingDispute}
                  className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-muted hover:text-ink hover:bg-black/5"
                >
                  {t("common.cancel", "Cancel")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
