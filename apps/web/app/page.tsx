"use client";

import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { AnimatedNumber } from "@/components/kit";
import { api } from "@/lib/api";
import { useT, type TKey } from "@/lib/i18n";

const steps = [
  { title: "home.how1Title", body: "home.how1Body" },
  { title: "home.how2Title", body: "home.how2Body" },
  { title: "home.how3Title", body: "home.how3Body" },
] as const satisfies ReadonlyArray<{ title: TKey; body: TKey }>;

const features = [
  "home.featureQueue",
  "home.featureLive",
  "home.featureNotes",
  "home.featureRoutes",
  "home.featureRoles",
  "home.featureLang",
] as const satisfies ReadonlyArray<TKey>;

export default function HomePage() {
  const t = useT();
  const [waiting, setWaiting] = useState<number | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let stop = false;
    const load = () => {
      void api.pulse().then((pulse) => {
        if (stop) return;
        setWaiting(pulse.waitingNow);
        setUnavailable(false);
      }).catch(() => {
        if (!stop) setUnavailable(true);
      });
    };
    load();
    const timer = window.setInterval(load, 4000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="flex flex-col gap-12 pb-4">
      <section className="hero rise -mx-4 -mt-6 overflow-hidden px-5 py-12 sm:mx-0 sm:mt-0 sm:rounded-[28px] sm:px-10 lg:grid lg:grid-cols-[1.3fr_.7fr] lg:items-end lg:gap-10 lg:py-16">
        <div>
          <Logo className="h-16 w-auto sm:h-20" priority />
          <h1 className="font-display mt-5 max-w-xl text-4xl font-bold leading-[1.05] sm:text-6xl">
            {t("home.headline")}
          </h1>
          <p className="mt-4 max-w-md text-lg text-white/90">{t("home.pitch")}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/register" variant="accent" className="sm:min-w-44">
              {t("home.ctaJoin")}
            </ButtonLink>
            <ButtonLink href="/#how" variant="secondary" className="sm:min-w-44">
              {t("home.ctaHow")}
            </ButtonLink>
          </div>
        </div>
        <div className="mt-8 rounded-[20px] bg-white/10 p-5 lg:mt-0" aria-live="polite">
          <p className="text-sm font-semibold uppercase tracking-wide text-taxi">{t("home.liveLabel")}</p>
          {unavailable && waiting === null ? (
            <p className="mt-4 text-lg">{t("home.liveUnavailable")}</p>
          ) : waiting === null ? (
            <div className="shimmer mt-4 h-16 w-28 rounded-xl bg-white/20" />
          ) : (
            <p className="mt-2 font-display text-6xl font-bold tabular-nums">
              <AnimatedNumber value={waiting} />
            </p>
          )}
          <p className="mt-1 text-white/85">{t("home.waitingNow")}</p>
        </div>
      </section>

      <section id="how" className="scroll-mt-6">
        <h2 className="font-display text-3xl font-bold">{t("home.howTitle")}</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="rounded-[20px] border border-line bg-card p-5 shadow-card">
              <p className="font-display text-3xl font-bold text-cobalt">{index + 1}</p>
              <h3 className="mt-2 text-lg font-bold">{t(step.title)}</h3>
              <p className="mt-2 text-muted">{t(step.body)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="font-display text-3xl font-bold">{t("home.featuresTitle")}</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {features.map((key) => (
            <li key={key} className="rounded-[20px] border border-line bg-card px-5 py-4 font-semibold shadow-card">
              {t(key)}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[20px] bg-cobalt-deep px-5 py-8 text-white sm:px-8">
        <h2 className="font-display text-3xl font-bold">{t("home.trustTitle")}</h2>
        <p className="mt-3 max-w-2xl text-lg text-white/90">{t("home.trustBody")}</p>
      </section>
    </div>
  );
}
