"use client";

import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { AnimatedNumber, RouteLine } from "@/components/kit";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";

export default function HomePage() {
  const t = useT();
  const [waiting, setWaiting] = useState(0);

  useEffect(() => {
    let stop = false;
    const load = () => {
      void api.pulse().then((pulse) => {
        if (!stop) setWaiting(pulse.waitingNow);
      }).catch(() => undefined);
    };
    load();
    const timer = window.setInterval(load, 4000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <section className="hero rise -mx-4 -mt-6 overflow-hidden px-5 py-12 sm:mx-0 sm:mt-0 sm:rounded-[28px] sm:px-10 lg:grid lg:grid-cols-[1.3fr_.7fr] lg:items-end lg:gap-8 lg:py-16">
        <div>
          <div className="inline-flex rounded-2xl bg-white px-3 py-2 shadow-card">
            <Logo className="h-20 w-auto sm:h-24" priority />
          </div>
          <h1 className="font-display mt-5 max-w-xl text-4xl font-bold leading-[1.05] sm:text-6xl">
            {t("home.headline")}
          </h1>
          <p className="mt-5 max-w-md text-lg text-white/85">{t("home.pitch")}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/login" variant="accent" className="sm:min-w-52">
              {t("home.joinPassenger")}
            </ButtonLink>
            <ButtonLink href="/login" variant="secondary" className="sm:min-w-44">
              {t("home.driverSignIn")}
            </ButtonLink>
          </div>
        </div>
        <div className="mt-8 rounded-[20px] bg-white/10 p-5 lg:mt-0">
          <RouteLine from={t("home.areaA")} to={t("home.areaB")} light />
          <p className="mt-4 font-display text-5xl font-bold tabular-nums">
            <AnimatedNumber value={waiting} />
          </p>
          <p className="text-white/80">{t("home.waitingNow")}</p>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {(["home.step1", "home.step2", "home.step3"] as const).map((key, index) => (
          <article key={key} className="rise rounded-[20px] border border-line bg-card p-5 shadow-card" style={{ animationDelay: `${index * 80}ms` }}>
            <p className="font-display text-3xl font-bold text-taxi">{index + 1}</p>
            <p className="mt-2 font-semibold">{t(key)}</p>
          </article>
        ))}
      </section>
      <p className="text-sm text-muted">{t("home.footer")}</p>
    </div>
  );
}
