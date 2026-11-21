"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/Button";
import { AnimatedNumber, Sparkline } from "@/components/kit";
import { useToast } from "@/components/Providers";
import { ErrorState, LoadingState } from "@/components/States";
import { StatusBadge } from "@/components/StatusBadge";
import { api, fetcher } from "@/lib/api";
import { REFRESH_MS } from "@/lib/config";
import { routeName } from "@/lib/format";
import { useLanguage, useT } from "@/lib/i18n";
import type { AdminStats, Report, ReportStatus } from "@/lib/types";

export default function AdminPage() {
  const t = useT();
  const lang = useLanguage();
  const toast = useToast();
  const stats = useSWR<AdminStats>("/admin/stats", fetcher, { refreshInterval: REFRESH_MS });
  const reports = useSWR<Report[]>("/admin/reports", fetcher, { refreshInterval: REFRESH_MS });
  const [filter, setFilter] = useState<ReportStatus | "ALL">("ALL");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function update(id: string, status: ReportStatus) {
    if (status === "RESOLVED" && note.trim().length < 3) {
      toast(t("admin.noteRequired"));
      return;
    }
    setBusy(id);
    try {
      await api.updateReport(id, { status, resolutionNote: note || undefined });
      toast(t("admin.updated"));
      setNote("");
      await reports.mutate();
      await stats.mutate();
    } catch (error) {
      toast(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(null);
    }
  }

  if ((stats.error && !stats.data) || (reports.error && !reports.data)) {
    return <ErrorState error={stats.error ?? reports.error} onRetry={() => { void stats.mutate(); void reports.mutate(); }} />;
  }
  if (!stats.data || !reports.data) return <LoadingState />;

  const open = reports.data.filter((report) => report.status !== "RESOLVED").length;
  const visible = reports.data.filter((report) => filter === "ALL" || report.status === filter);
  const maxLoad = Math.max(...stats.data.loadFactorByRoute.map((item) => item.loadFactor), 0.01);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-bold">{t("admin.title")}</h1>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("admin.wait")} value={stats.data.averageWaitMinutes} suffix={t("admin.minutes")} />
        <Stat label={t("admin.trips")} value={stats.data.tripsToday} />
        <Stat label={t("admin.waiting")} value={stats.data.waitingNow} />
        <Stat label={t("admin.openReports")} value={open} />
      </section>
      <p className="text-sm text-muted">{t("admin.noRatings")}</p>

      <section className="rounded-[20px] bg-card p-5 shadow-card">
        <h2 className="font-display text-xl font-bold">{t("admin.load")}</h2>
        <div className="mt-4 flex flex-col gap-3">
          {stats.data.loadFactorByRoute.map((item) => (
            <div key={item.route.id}>
              <div className="mb-1 flex justify-between text-sm">
                <span>{routeName(item.route, lang)}</span>
                <span className="tabular-nums">{Math.round(item.loadFactor * 100)}%</span>
              </div>
              <div className="h-3 rounded-full bg-sky">
                <div className="h-3 rounded-full bg-cobalt" style={{ width: `${(item.loadFactor / maxLoad) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
        {stats.data.waitSamples && <Sparkline values={stats.data.waitSamples} />}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {(["ALL", "OPEN", "IN_REVIEW", "RESOLVED"] as const).map((status) => (
            <button
              key={status}
              type="button"
              className={`min-h-12 rounded-full px-4 text-sm font-semibold ${filter === status ? "bg-cobalt text-white" : "bg-card"}`}
              onClick={() => setFilter(status)}
            >
              {status === "ALL" ? t("admin.filterAll") : t(`status.${status}`)}
            </button>
          ))}
        </div>
        {visible.map((report) => (
          <article key={report.id} className="rounded-[20px] bg-card p-4 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">{t(`report.${report.type}`)}</p>
              <StatusBadge status={report.status} />
            </div>
            <p className="mt-2">{report.description}</p>
            {report.driverResponse && <p className="mt-2 text-sm text-muted">{report.driverResponse}</p>}
            {report.status !== "RESOLVED" && (
              <div className="mt-3 flex flex-col gap-2">
                <input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={t("admin.note")}
                  className="min-h-12 rounded-[14px] border border-line px-3"
                />
                <div className="flex flex-wrap gap-2">
                  {report.status === "OPEN" && (
                    <Button loading={busy === report.id} onClick={() => void update(report.id, "IN_REVIEW")}>{t("admin.inReview")}</Button>
                  )}
                  <Button variant="accent" loading={busy === report.id} onClick={() => void update(report.id, "RESOLVED")}>{t("admin.resolve")}</Button>
                </div>
              </div>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number | null; suffix?: string }) {
  const t = useT();
  return (
    <article className="rounded-[20px] bg-card p-4 shadow-card">
      <p className="text-sm text-muted">{label}</p>
      {value === null ? (
        <p className="mt-2 font-semibold">{t("admin.noData")}</p>
      ) : (
        <p className="font-display text-4xl font-bold">
          <AnimatedNumber value={value} />
          {suffix && <span className="ml-1 text-base font-semibold text-muted">{suffix}</span>}
        </p>
      )}
    </article>
  );
}
