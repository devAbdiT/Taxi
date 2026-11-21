"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/Button";
import { CallControls } from "@/components/driver/CallControls";
import { PassengerList } from "@/components/driver/PassengerList";
import { StepHeader } from "@/components/driver/StepHeader";
import { ErrorState, FormError, LoadingState } from "@/components/States";
import { StatusBadge } from "@/components/StatusBadge";
import { api, fetcher } from "@/lib/api";
import { REFRESH_MS } from "@/lib/config";
import { countKey, routeName, stationName } from "@/lib/format";
import { useLanguage, useT } from "@/lib/i18n";
import type { TripDetail } from "@/lib/types";

interface TripPanelProps {
  tripId: string;
  /** Passengers currently WAITING on the trip's route. */
  waiting: number;
  onChanged: () => Promise<unknown>;
}

export function TripPanel({ tripId, waiting, onChanged }: TripPanelProps) {
  const t = useT();
  const lang = useLanguage();
  const { data: trip, error, mutate } = useSWR<TripDetail>(`/driver/trips/${tripId}`, fetcher, {
    refreshInterval: REFRESH_MS,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  async function run(id: string, action: () => Promise<TripDetail>) {
    setBusy(id);
    setActionError(null);
    try {
      const updated = await action();
      await mutate(updated, { revalidate: false });
      await onChanged();
      setConfirmingCancel(false);
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(null);
    }
  }

  if (error && !trip) return <ErrorState error={error} onRetry={() => mutate()} />;
  if (!trip) return <LoadingState />;

  const loading = trip.status === "LOADING";
  const seatsLeft = trip.seatsLeft;
  const boarded = trip.entries.filter((e) => e.status === "BOARDED").length;
  const stillCalled = trip.entries.filter((e) => e.status === "CALLED").length;
  const destination = stationName(trip.route.destination, lang);

  return (
    <section className="flex flex-col gap-4 rounded-2xl border-2 border-slate-200 bg-white p-4">
      <StepHeader
        step={loading ? 3 : 4}
        title={loading ? t("driver.stepLoad") : t("driver.stepDrive", { station: destination })}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-lg font-semibold">{routeName(trip.route, lang)}</p>
        <StatusBadge status={trip.status} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-slate-100 p-3">
          <p className="text-3xl font-bold tabular-nums">{trip.seatsUsed}</p>
          <p className="text-sm">{t("driver.seatsUsed")}</p>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3 text-emerald-950">
          <p className="text-3xl font-bold tabular-nums">{seatsLeft}</p>
          <p className="text-sm">
            {t(countKey(seatsLeft, "driver.seatsLeftNone", "driver.seatsLeftOne", "driver.seatsLeftMany"))}
          </p>
        </div>
      </div>

      {loading && seatsLeft > 0 && (
        <CallControls
          seatsLeft={seatsLeft}
          waiting={waiting}
          busy={busy === "call"}
          onCall={(count) => run("call", () => api.callPassengers(trip.id, count === undefined ? {} : { count }))}
        />
      )}

      <PassengerList
        entries={trip.entries}
        canManage={loading}
        busyId={busy}
        onBoard={(id) => run(`board:${id}`, () => api.boardEntry(id))}
        onNoShow={(id) => run(`noshow:${id}`, () => api.noShowEntry(id))}
      />

      <FormError error={actionError} />

      {loading ? (
        <div className="flex flex-col gap-3 border-t-2 border-slate-100 pt-4">
          {boarded === 0 ? (
            <p className="text-slate-700">{t("driver.departNeedsBoarded")}</p>
          ) : (
            stillCalled > 0 && (
              <p className="font-medium text-amber-900">
                {t(stillCalled === 1 ? "driver.departWarningOne" : "driver.departWarningMany", { n: stillCalled })}
              </p>
            )
          )}
          <Button
            onClick={() => run("depart", () => api.departTrip(trip.id))}
            loading={busy === "depart"}
            disabled={boarded === 0 || (!!busy && busy !== "depart")}
            fullWidth
          >
            {t("driver.depart")} · {t("driver.onBoard", { n: boarded })}
          </Button>

          {confirmingCancel ? (
            <div className="flex flex-col gap-2 rounded-xl border-2 border-red-300 bg-red-50 p-3">
              <p className="font-semibold text-red-950">{t("driver.cancelConfirm")}</p>
              <Button
                variant="danger"
                onClick={() => run("cancel", () => api.cancelTrip(trip.id))}
                loading={busy === "cancel"}
                fullWidth
              >
                {t("driver.cancelYes")}
              </Button>
              <Button variant="secondary" onClick={() => setConfirmingCancel(false)} disabled={!!busy} fullWidth>
                {t("driver.cancelNo")}
              </Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setConfirmingCancel(true)} disabled={!!busy} fullWidth>
              {t("driver.cancel")}
            </Button>
          )}
        </div>
      ) : (
        trip.status === "DEPARTED" && (
          <Button onClick={() => run("arrive", () => api.arriveTrip(trip.id))} loading={busy === "arrive"} fullWidth>
            {t("driver.arriveAt", { station: destination })}
          </Button>
        )
      )}
    </section>
  );
}
