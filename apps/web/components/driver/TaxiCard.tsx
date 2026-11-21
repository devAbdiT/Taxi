"use client";

import { Icon } from "@/components/Icon";
import { SeatGrid } from "@/components/kit";
import { StatusBadge } from "@/components/StatusBadge";
import { stationName } from "@/lib/format";
import { useLanguage, useT } from "@/lib/i18n";
import type { DriverMe } from "@/lib/types";

export function TaxiCard({ me }: { me: DriverMe }) {
  const t = useT();
  const lang = useLanguage();
  const { taxi, seatsUsed } = me;
  const percent = Math.min(100, Math.round((seatsUsed / taxi.capacity) * 100));

  return (
    <section aria-labelledby="taxi-title" className="flex flex-col gap-3 rounded-[20px] border border-line bg-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 id="taxi-title" className="text-sm font-semibold uppercase tracking-wide text-muted">
            {t("driver.title")}
          </h1>
          <p className="text-3xl font-bold tabular-nums">{taxi.plate}</p>
        </div>
        <StatusBadge status={taxi.status} />
      </div>

      <p className="flex items-center gap-2 text-lg">
        <Icon name="flag" />
        {taxi.currentStation
          ? t("driver.atStation", { station: stationName(taxi.currentStation, lang) })
          : t("driver.notAtStation")}
      </p>

      <div className="flex flex-col gap-1.5">
        <p className="flex items-center gap-2 text-lg font-semibold">
          <Icon name="users" />
          {t("driver.seats", { used: seatsUsed, capacity: taxi.capacity })}
        </p>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={taxi.capacity}
          aria-valuenow={seatsUsed}
          aria-label={t("driver.seats", { used: seatsUsed, capacity: taxi.capacity })}
          className="h-3 overflow-hidden rounded-full bg-sky"
        >
          <div className="h-full rounded-full bg-cobalt" style={{ width: `${percent}%` }} />
        </div>
        <SeatGrid used={seatsUsed} capacity={taxi.capacity} />
      </div>
    </section>
  );
}
