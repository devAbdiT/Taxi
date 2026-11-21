"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Button } from "@/components/Button";
import { ChoiceCard } from "@/components/ChoiceCard";
import { Field } from "@/components/Field";
import { FormError } from "@/components/States";
import { api, fetcher } from "@/lib/api";
import { routeName } from "@/lib/format";
import { useLanguage, useT } from "@/lib/i18n";
import type { PassengerTrip, ReportType } from "@/lib/types";

const TYPES: ReportType[] = [
  "OVERCHARGING",
  "UNSAFE_DRIVING",
  "DISRESPECT",
  "DISCRIMINATION",
  "LOST_PROPERTY",
  "OTHER",
];

export default function ReportPage() {
  return (
    <Suspense>
      <ReportForm />
    </Suspense>
  );
}

function ReportForm() {
  const t = useT();
  const lang = useLanguage();
  const params = useSearchParams();
  const trips = useSWR<PassengerTrip[]>("/trips/mine", fetcher);
  const [type, setType] = useState<ReportType>("OVERCHARGING");
  const [description, setDescription] = useState("");
  const [tripId, setTripId] = useState(params.get("tripId") ?? "");
  const [localError, setLocalError] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (description.trim().length < 5) {
      setLocalError(t("report.tooShort"));
      return;
    }
    setLocalError(null);
    setSaving(true);
    setError(null);
    try {
      await api.report({ type, description: description.trim(), tripId: tripId || undefined });
      setSent(true);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  if (sent) {
    return (
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">{t("report.title")}</h1>
        <p role="status" className="rounded-2xl border-2 border-emerald-600 bg-emerald-50 p-4 text-lg font-semibold text-emerald-950">
          {t("report.thanks")}
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">{t("report.title")}</h1>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-semibold">{t("report.type")}</legend>
          {TYPES.map((item) => (
            <ChoiceCard key={item} name="type" value={item} checked={type === item} onSelect={() => setType(item)}>
              <span className="font-semibold">{t(`reportType.${item}`)}</span>
            </ChoiceCard>
          ))}
        </fieldset>
        <Field
          label={t("report.description")}
          hint={t("report.hint")}
          error={localError ?? undefined}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <label className="flex flex-col gap-1.5 font-semibold">
          {t("report.trip")}
          <select
            value={tripId}
            onChange={(event) => setTripId(event.target.value)}
            className="min-h-12 rounded-xl border-2 border-slate-400 bg-white px-3 text-base font-normal"
          >
            <option value="">{t("report.noTrip")}</option>
            {trips.data?.map((trip) => (
              <option key={trip.tripId} value={trip.tripId}>
                {routeName(trip.route, lang)} · {trip.taxiPlate}
              </option>
            ))}
          </select>
        </label>
        <FormError error={error} />
        <Button type="submit" loading={saving} fullWidth>
          {t("report.submit")}
        </Button>
      </form>
    </section>
  );
}
