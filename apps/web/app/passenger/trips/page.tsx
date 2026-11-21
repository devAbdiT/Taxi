"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/Button";
import { useToast } from "@/components/Providers";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { RelativeTime } from "@/components/RelativeTime";
import { api, fetcher } from "@/lib/api";
import { routeName } from "@/lib/format";
import { useLanguage, useT, type TKey } from "@/lib/i18n";
import type { MyTripsResponse, RatingTag } from "@/lib/types";

const tags: { id: RatingTag; label: TKey }[] = [
  { id: "PUNCTUALITY", label: "trips.punctuality" },
  { id: "CLEANLINESS", label: "trips.cleanliness" },
  { id: "SAFETY", label: "trips.safety" },
  { id: "BEHAVIOR", label: "trips.behavior" },
];

export default function TripsPage() {
  const t = useT();
  const lang = useLanguage();
  const toast = useToast();
  const trips = useSWR<MyTripsResponse>("/trips/mine", fetcher);
  const [openId, setOpenId] = useState<string | null>(null);
  const [stars, setStars] = useState(5);
  const [picked, setPicked] = useState<RatingTag[]>([]);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(tripId: string) {
    setSending(true);
    try {
      await api.rate({ tripId, stars, tags: picked, comment: comment || undefined });
      toast(t("trips.thanks"));
      setOpenId(null);
      await trips.mutate();
    } catch (error) {
      toast(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setSending(false);
    }
  }

  if (trips.error && !trips.data) return <ErrorState error={trips.error} onRetry={() => trips.mutate()} />;
  if (!trips.data) return <LoadingState />;
  if (trips.data.trips.length === 0) return <EmptyState title={t("trips.empty")} />;

  return (
    <section className="flex flex-col gap-4">
      <h1 className="font-display text-3xl font-bold">{t("trips.title")}</h1>
      <div className="grid gap-4 xl:grid-cols-2">
      {trips.data.trips.map((trip) => (
        <article key={trip.tripId} className="rise flex flex-col gap-2 rounded-[20px] bg-card p-4 shadow-card">
          <p className="font-semibold">{routeName(trip.route, lang)}</p>
          <p className="text-sm text-muted">
            {trip.driverFirstName} · {trip.taxiPlate}
            {trip.arrivedAt && <> · <RelativeTime date={trip.arrivedAt} /></>}
          </p>
          <p className="text-sm font-semibold">{t(`status.${trip.status}`)}</p>
          {trip.rated && <p className="text-sm font-semibold text-go">{t("trips.rated")}</p>}
          {trip.canRate && openId !== trip.tripId && (
            <Button onClick={() => setOpenId(trip.tripId)} fullWidth>{t("trips.rate")}</Button>
          )}
          {openId === trip.tripId && (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`min-h-12 min-w-12 rounded-full text-xl ${value <= stars ? "bg-taxi" : "bg-line"}`}
                    onClick={() => setStars(value)}
                    aria-label={String(value)}
                  >
                    ★
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    className={`min-h-12 rounded-full px-4 text-sm font-semibold ${picked.includes(tag.id) ? "bg-cobalt text-white" : "bg-sky"}`}
                    onClick={() => setPicked((current) => current.includes(tag.id) ? current.filter((item) => item !== tag.id) : [...current, tag.id])}
                  >
                    {t(tag.label)}
                  </button>
                ))}
              </div>
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder={t("trips.comment")}
                className="min-h-24 rounded-[14px] border border-line p-3"
              />
              <Button loading={sending} onClick={() => void submit(trip.tripId)} fullWidth>{t("trips.submit")}</Button>
            </div>
          )}
        </article>
      ))}
      </div>
    </section>
  );
}
