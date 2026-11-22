"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { ChoiceCard } from "@/components/ChoiceCard";
import { StepHeader } from "@/components/driver/StepHeader";
import { EmptyState, FormError } from "@/components/States";
import { api } from "@/lib/api";
import { countKey, routeName, stationName } from "@/lib/format";
import { useLanguage, useT } from "@/lib/i18n";
import type { DemandRoute, Station } from "@/lib/types";

interface StartLoadingProps {
  station: Station;
  routes: DemandRoute[];
  onStarted: () => Promise<unknown>;
}

export function StartLoading({ station, routes, onStarted }: StartLoadingProps) {
  const t = useT();
  const lang = useLanguage();
  const fromHere = routes.filter((route) => route.origin.id === station.id);
  const [routeId, setRouteId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const selected = routeId ?? (fromHere.length === 1 ? fromHere[0].id : null);

  async function start() {
    if (!selected) return;
    setStarting(true);
    setError(null);
    try {
      await api.startTrip({ routeId: selected });
      await onStarted();
      setRouteId(null);
    } catch (err) {
      setError(err);
    } finally {
      setStarting(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border-2 border-slate-200 bg-white p-4">
      <StepHeader step={2} title={t("driver.stepStart")} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-lg font-semibold">{t("driver.startTitle")}</legend>
        <p className="text-slate-700">{t("driver.startHint", { station: stationName(station, lang) })}</p>
        {fromHere.length === 0 ? (
          <EmptyState title={t("driver.noRoutesHere")} />
        ) : (
          fromHere.map((route) => (
            <ChoiceCard
              key={route.id}
              name="start-route"
              value={route.id}
              checked={selected === route.id}
              onSelect={() => setRouteId(route.id)}
            >
              <span className="block text-lg font-semibold">{routeName(route, lang)}</span>
              <span className="block">
                {t(countKey(route.waiting, "passenger.waitingNone", "passenger.waitingOne", "passenger.waitingMany"), {
                  n: route.waiting,
                })}
              </span>
            </ChoiceCard>
          ))
        )}
      </fieldset>
      <FormError error={error} />
      <Button onClick={start} loading={starting} disabled={!selected} fullWidth>
        {t("driver.startButton")}
      </Button>
    </section>
  );
}
