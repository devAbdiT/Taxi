"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Button } from "@/components/Button";
import { ChoiceCard } from "@/components/ChoiceCard";
import { useUser } from "@/components/RequireRole";
import { Icon } from "@/components/Icon";
import { EmptyState, ErrorState, FormError, LoadingState } from "@/components/States";
import { StatusBadge } from "@/components/StatusBadge";
import { api, ApiError, fetcher } from "@/lib/api";
import { REFRESH_MS } from "@/lib/config";
import { countKey, routeName } from "@/lib/format";
import { useLanguage, useT } from "@/lib/i18n";
import type { AssistanceType, MyQueueResponse, RoutesResponse } from "@/lib/types";

const ROUTES_KEY = "/routes";
const MY_QUEUE_KEY = "/queue/me";

const assistanceTypes: AssistanceType[] = ["NONE", "DISABILITY", "ELDERLY", "PREGNANT", "MOBILITY", "OTHER"];

function GoToQueueLink() {
  const t = useT();
  return (
    <Link
      href="/passenger/queue"
      className="inline-flex min-h-12 items-center gap-2 font-semibold text-cobalt underline"
    >
      {t("passenger.goToQueue")}
      <Icon name="arrowRight" />
    </Link>
  );
}

export default function PassengerRoutesPage() {
  const t = useT();
  const user = useUser();
  const lang = useLanguage();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const routes = useSWR<RoutesResponse>(ROUTES_KEY, fetcher, { refreshInterval: REFRESH_MS });
  const myQueue = useSWR<MyQueueResponse>(MY_QUEUE_KEY, fetcher);

  const [routeId, setRouteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [assistance, setAssistance] = useState<AssistanceType>("NONE");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [alreadyQueued, setAlreadyQueued] = useState(false);

  async function join() {
    if (!routeId) return;
    setJoining(true);
    setError(null);
    setAlreadyQueued(false);
    try {
      await api.joinQueue({ routeId, assistance });
      await mutate(MY_QUEUE_KEY);
      void mutate(ROUTES_KEY);
      router.push("/passenger/queue");
    } catch (err) {
      if (err instanceof ApiError && err.code === "already_in_queue") setAlreadyQueued(true);
      else setError(err);
    } finally {
      // Pages stay mounted (hidden) after navigating away, so reset for when the user comes back.
      setJoining(false);
    }
  }

  const activeEntry = myQueue.data?.entry;
  const activeRoute = activeEntry?.route;
  const query = search.trim().toLowerCase();
  const routeList = routes.data?.routes ?? [];
  const visibleRoutes = routeList.filter((route) => {
    if (!query) return true;
    const text = [route.origin.name, route.origin.nameAm, route.destination.name, route.destination.nameAm]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return text.includes(query);
  });

  return (
    <section className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-bold">{t("home.welcome", { name: user.name.split(" ")[0] })}</h1>
      <p className="text-muted">{t("passenger.title")}</p>

      {/* GPS On-Demand Pickup Banner */}
      <Link
        href="/passenger/pickup"
        className="flex items-center justify-between rounded-2xl border-2 border-taxi bg-taxi/15 p-4 transition hover:bg-taxi/25 active:scale-[.99]"
      >
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-full bg-taxi text-ink font-bold">
            <Icon name="car" className="size-6" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-ink">
              {t("pickup.title", "Request a Pickup")}
            </h2>
            <p className="text-xs text-muted">
              {t("pickup.subtitle", "Get picked up by an available taxi nearby")}
            </p>
          </div>
        </div>
        <span className="flex size-8 items-center justify-center rounded-full bg-card border border-line text-ink">
          <Icon name="arrowRight" className="size-4" />
        </span>
      </Link>

      {activeEntry && activeRoute && (
        <div className="flex flex-col gap-1 rounded-[20px] bg-go-soft p-4 text-ink">
          <p className="font-semibold">{t("passenger.inQueueBanner", { route: routeName(activeRoute, lang) })}</p>
          <GoToQueueLink />
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-lg font-bold">{t("passenger.stepRoute")}</legend>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t("passenger.searchLabel")}</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("passenger.searchPlaceholder")}
            className="min-h-12 rounded-[14px] border-2 border-line bg-card px-4 text-base focus:outline-none focus-visible:ring-4 focus-visible:ring-taxi"
          />
        </label>
        {routes.error && !routes.data ? (
          <ErrorState error={routes.error} onRetry={() => routes.mutate()} />
        ) : !routes.data ? (
          <LoadingState />
        ) : routeList.length === 0 ? (
          <EmptyState title={t("passenger.noRoutes")} />
        ) : visibleRoutes.length === 0 ? (
          <EmptyState title={t("passenger.noMatch")} />
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">{visibleRoutes.map((route) => (
            <ChoiceCard
              key={route.id}
              name="route"
              value={route.id}
              checked={routeId === route.id}
              onSelect={() => setRouteId(route.id)}
            >
              <span className="block text-lg font-bold">{routeName(route, lang)}</span>
              <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-base">
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="users" />
                  {t(countKey(route.waiting, "passenger.waitingNone", "passenger.waitingOne", "passenger.waitingMany"), {
                    n: route.waiting,
                  })}
                </span>
                {route.priorityWaiting > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name="star" />
                    {t("passenger.priorityWaiting", { n: route.priorityWaiting })}
                  </span>
                )}
              </span>
              <span className="mt-1 flex items-center gap-1.5 text-base">
                <Icon name="flag" />
                {t(countKey(route.taxisAvailable, "passenger.taxisNone", "passenger.taxisOne", "passenger.taxisMany"), {
                  n: route.taxisAvailable,
                })}
              </span>
            </ChoiceCard>
          ))}</div>
        )}
      </fieldset>

      <div className="flex flex-col gap-4 xl:sticky xl:top-24">
      <fieldset className="flex flex-col gap-3 rounded-[20px] border border-line bg-card p-4 shadow-card">
        <legend className="text-lg font-bold">{t("passenger.stepAssistance")}</legend>
        <p className="-mt-1 text-slate-700">{t("passenger.assistanceHint")}</p>
        <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
          {assistanceTypes.map((type) => (
            <ChoiceCard
              key={type}
              name="assistance"
              value={type}
              checked={assistance === type}
              onSelect={() => setAssistance(type)}
              className={type === "NONE" ? "min-[400px]:col-span-2" : ""}
            >
              <span className="text-base font-semibold">{t(`assistance.${type}`)}</span>
            </ChoiceCard>
          ))}
        </div>
        {assistance !== "NONE" && (
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status="PRIORITY" />
            <span className="text-slate-800">{t("passenger.youGetPriority")}</span>
          </div>
        )}
      </fieldset>

      <div className="flex flex-col gap-3">
        {alreadyQueued && (
          <div role="alert" className="flex flex-col gap-1 rounded-xl border-2 border-amber-400 bg-amber-50 p-3 text-amber-950">
            <p className="flex items-start gap-2">
              <Icon name="alert" className="mt-0.5 size-5" />
              {t("passenger.alreadyInQueue")}
            </p>
            <GoToQueueLink />
          </div>
        )}
        <FormError error={error} />
        {!routeId && <p className="text-center text-slate-700">{t("passenger.chooseRouteFirst")}</p>}
        <Button onClick={join} loading={joining} disabled={!routeId} fullWidth>
          {t("passenger.join")}
        </Button>
      </div>
      </div>
      </div>
    </section>
  );
}
