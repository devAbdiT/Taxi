"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { RelativeTime } from "@/components/RelativeTime";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { StatusBadge, type BadgeStatus } from "@/components/StatusBadge";
import { api, ApiError, setToken } from "@/lib/api";
import { USE_MOCKS } from "@/lib/config";
import { useLanguage } from "@/lib/i18n";
import { useNow } from "@/lib/time";
import type { RouteSummary, Station } from "@/lib/types";

const badges: BadgeStatus[] = [
  "WAITING", "CALLED", "BOARDED", "CANCELLED", "NO_SHOW",
  "OFFLINE", "AT_STATION", "LOADING", "EN_ROUTE", "DEPARTED", "COMPLETED",
  "OPEN", "IN_REVIEW", "RESOLVED", "PRIORITY",
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

export default function DevUiPage() {
  const lang = useLanguage();
  const now = useNow();
  const [routes, setRoutes] = useState<RouteSummary[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const stationName = (s: Station) => (lang === "am" && s.nameAm) || s.name;

  async function runMockCheck() {
    setBusy(true);
    setError(null);
    try {
      const { token } = await api.login({ phone: "0911000100", password: "demo1234" });
      setToken(token);
      setRoutes(await api.routes());
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold">UI preview</h1>

      <Section title="API check">
        <p className="text-slate-700">Mocks: {USE_MOCKS ? "on" : "off"}</p>
        <Button onClick={runMockCheck} loading={busy} fullWidth>
          Log in as demo passenger and load routes
        </Button>
        {error ? <ErrorState error={error} onRetry={runMockCheck} /> : null}
        {routes && (
          <ul className="flex flex-col gap-2">
            {routes.map((r) => (
              <li key={r.id} className="rounded-xl border-2 border-slate-200 bg-white p-3">
                <p className="font-semibold">
                  {stationName(r.origin)} → {stationName(r.destination)}
                </p>
                <p className="text-slate-700">
                  {r.waiting} waiting · {r.priorityWaiting} priority · {r.taxisAvailable} taxis
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Buttons">
        <Button fullWidth>Primary</Button>
        <Button variant="secondary" fullWidth>Secondary</Button>
        <Button variant="danger" fullWidth>Danger</Button>
        <Button loading fullWidth>Loading</Button>
        <Button disabled fullWidth>Disabled</Button>
      </Section>

      <Section title="Status badges">
        <div className="flex flex-wrap gap-2">
          {badges.map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
        </div>
      </Section>

      <Section title="Relative time">
        {now > 0 && (
          <ul className="flex flex-col gap-1">
            {[0, 5, 125, 60 * 24 * 3].map((minutes) => (
              <li key={minutes}>
                <RelativeTime date={new Date(now - minutes * 60_000).toISOString()} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="States">
        <LoadingState />
        <EmptyState />
        <ErrorState error={new ApiError(409, "already_in_queue", "")} onRetry={() => {}} />
        <ErrorState error={new ApiError(500, "something_unknown", "")} />
      </Section>
    </div>
  );
}
