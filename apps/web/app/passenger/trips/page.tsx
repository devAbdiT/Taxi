"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { EmptyState, ErrorState, FormError, LoadingState } from "@/components/States";
import { StatusBadge } from "@/components/StatusBadge";
import { api, fetcher } from "@/lib/api";
import { routeName } from "@/lib/format";
import { useLanguage, useT } from "@/lib/i18n";
import type { PassengerTrip, RatingTag } from "@/lib/types";

const TAGS: RatingTag[] = ["PUNCTUALITY", "CLEANLINESS", "SAFETY", "BEHAVIOR"];

function RatingForm({ trip, onSaved }: { trip: PassengerTrip; onSaved: () => void }) {
  const t = useT();
  const [stars, setStars] = useState(5);
  const [tags, setTags] = useState<RatingTag[]>([]);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await api.rate({ tripId: trip.tripId, stars, tags, comment: comment.trim() || undefined });
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={stars === value}
            aria-label={t("trips.stars", { n: value })}
            onClick={() => setStars(value)}
            className={`min-h-12 rounded-xl border-2 text-lg font-bold ${
              stars === value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white"
            }`}
          >
            {value}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {TAGS.map((tag) => {
          const on = tags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              aria-pressed={on}
              onClick={() => setTags(on ? tags.filter((item) => item !== tag) : [...tags, tag])}
              className={`min-h-12 rounded-full border-2 px-4 font-semibold ${
                on ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-300 bg-white"
              }`}
            >
              {t(`tags.${tag}`)}
            </button>
          );
        })}
      </div>
      <Field label={t("trips.comment")} value={comment} onChange={(event) => setComment(event.target.value)} />
      <FormError error={error} />
      <Button onClick={submit} loading={saving} fullWidth>
        {t("trips.submit")}
      </Button>
    </div>
  );
}

export default function TripsPage() {
  const t = useT();
  const lang = useLanguage();
  const { data, error, mutate } = useSWR<PassengerTrip[]>("/trips/mine", fetcher);
  const [open, setOpen] = useState<string | null>(null);

  if (error && !data) return <ErrorState error={error} onRetry={() => mutate()} />;
  if (!data) return <LoadingState />;
  if (data.length === 0) return <EmptyState title={t("trips.empty")} />;

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t("trips.title")}</h1>
      <ul className="flex flex-col gap-3">
        {data.map((trip) => (
          <li key={trip.tripId} className="flex flex-col gap-3 rounded-2xl border-2 border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-lg font-semibold">{routeName(trip.route, lang)}</p>
              <StatusBadge status={trip.status} />
            </div>
            <p className="text-slate-700">
              {trip.taxiPlate} · {trip.driverFirstName}
            </p>
            {trip.rated ? (
              <p className="font-semibold text-emerald-800">{t("trips.rated")}</p>
            ) : trip.canRate ? (
              open === trip.tripId ? (
                <RatingForm
                  trip={trip}
                  onSaved={() => {
                    setOpen(null);
                    void mutate();
                  }}
                />
              ) : (
                <Button onClick={() => setOpen(trip.tripId)} fullWidth>
                  {t("trips.rate")}
                </Button>
              )
            ) : null}
            <Link href={`/passenger/report?tripId=${trip.tripId}`} className="min-h-12 py-3 font-semibold text-emerald-800 underline">
              {t("trips.report")}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
