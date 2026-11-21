"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/Button";
import { useToast } from "@/components/Providers";
import { ErrorState, LoadingState } from "@/components/States";
import { api, fetcher } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { PassengerTrip, ReportType } from "@/lib/types";

const types: ReportType[] = ["OVERCHARGING", "UNSAFE_DRIVING", "DISRESPECT", "DISCRIMINATION", "LOST_PROPERTY", "OTHER"];

export default function ReportPage() {
  const t = useT();
  const toast = useToast();
  const trips = useSWR<PassengerTrip[]>("/trips/mine", fetcher);
  const [type, setType] = useState<ReportType>("OVERCHARGING");
  const [description, setDescription] = useState("");
  const [tripId, setTripId] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    setSending(true);
    try {
      await api.report({ type, description, tripId: tripId || undefined });
      setDone(true);
      toast(t("report.sent"));
    } catch (error) {
      toast(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <section className="rounded-[20px] bg-go-soft p-6">
        <h1 className="font-display text-3xl font-bold">{t("report.sent")}</h1>
      </section>
    );
  }
  if (trips.error && !trips.data) return <ErrorState error={trips.error} onRetry={() => trips.mutate()} />;
  if (!trips.data) return <LoadingState />;

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <h1 className="font-display text-3xl font-bold">{t("report.title")}</h1>
      <div className="flex flex-wrap gap-2">
        {types.map((item) => (
          <button
            key={item}
            type="button"
            className={`min-h-12 rounded-full px-4 text-sm font-semibold ${type === item ? "bg-cobalt text-white" : "bg-card"}`}
            onClick={() => setType(item)}
          >
            {t(`report.${item}`)}
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-1 font-semibold">
        {t("report.description")}
        <textarea
          value={description}
          maxLength={400}
          onChange={(event) => setDescription(event.target.value)}
          className="min-h-28 rounded-[14px] border border-line p-3 font-normal"
        />
        <span className="text-sm font-normal text-muted">{description.length}/400</span>
      </label>
      <label className="flex flex-col gap-1 font-semibold">
        {t("report.trip")}
        <select value={tripId} onChange={(event) => setTripId(event.target.value)} className="min-h-12 rounded-[14px] border border-line bg-card px-3">
          <option value="">{t("report.none")}</option>
          {trips.data.map((trip) => (
            <option key={trip.id} value={trip.id}>{trip.taxiPlate}</option>
          ))}
        </select>
      </label>
      <Button disabled={description.trim().length < 8} loading={sending} onClick={() => void submit()}>
        {t("report.send")}
      </Button>
    </section>
  );
}
