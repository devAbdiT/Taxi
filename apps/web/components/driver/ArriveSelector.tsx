"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/Button";
import { ChoiceCard } from "@/components/ChoiceCard";
import { ErrorState, FormError, LoadingState } from "@/components/States";
import { api, fetcher } from "@/lib/api";
import { stationName } from "@/lib/format";
import { useLanguage, useT } from "@/lib/i18n";
import type { Station } from "@/lib/types";

/** Shown while the taxi is offline or on the road; arriving is only allowed from those states. */
export function ArriveSelector({ onArrived }: { onArrived: () => Promise<unknown> }) {
  const t = useT();
  const lang = useLanguage();
  const stations = useSWR<Station[]>("/stations", fetcher);
  const [stationId, setStationId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function arrive() {
    if (!stationId) return;
    setSaving(true);
    setError(null);
    try {
      await api.driverArrive({ stationId });
      await onArrived();
      setStationId(null);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border-2 border-amber-400 bg-amber-50 p-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-lg font-bold">{t("driver.arriveTitle")}</legend>
        <p className="text-slate-800">{t("driver.arriveHint")}</p>
        {stations.error && !stations.data ? (
          <ErrorState error={stations.error} onRetry={() => stations.mutate()} />
        ) : !stations.data ? (
          <LoadingState />
        ) : (
          stations.data.map((s) => (
            <ChoiceCard key={s.id} name="station" value={s.id} checked={stationId === s.id} onSelect={() => setStationId(s.id)}>
              <span className="text-lg font-semibold">{stationName(s, lang)}</span>
            </ChoiceCard>
          ))
        )}
      </fieldset>
      <FormError error={error} />
      <Button onClick={arrive} loading={saving} disabled={!stationId} fullWidth>
        {t("driver.arriveButton")}
      </Button>
    </section>
  );
}
