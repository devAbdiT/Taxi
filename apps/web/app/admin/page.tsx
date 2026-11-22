"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/Button";
import { AnimatedNumber } from "@/components/kit";
import { useToast } from "@/components/Providers";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { StatusBadge } from "@/components/StatusBadge";
import { FleetMap } from "@/components/FleetMap";
import { api, fetcher } from "@/lib/api";
import { REFRESH_MS } from "@/lib/config";
import { routeName } from "@/lib/format";
import { useLanguage, useT } from "@/lib/i18n";
import type { AdminReportsResponse, AdminStatsResponse, ReportStatus } from "@/lib/types";

export default function AdminPage() {
  const t = useT();
  const lang = useLanguage();
  const toast = useToast();
  const stats = useSWR<AdminStatsResponse>("/admin/stats", fetcher, { refreshInterval: REFRESH_MS });
  const reports = useSWR<AdminReportsResponse>("/admin/reports", fetcher, { refreshInterval: REFRESH_MS });
  const [filter, setFilter] = useState<ReportStatus | "ALL">("ALL");
  const [query, setQuery] = useState("");
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

  const reportList = reports.data.reports;
  const open = reportList.filter((report) => report.status !== "RESOLVED").length;
  const needle = query.trim().toLowerCase();
  const visible = reportList.filter((report) => {
    if (filter !== "ALL" && report.status !== filter) return false;
    if (!needle) return true;
    const text = `${t(`report.${report.type}`)} ${report.description} ${report.driverResponse ?? ""}`.toLowerCase();
    return text.includes(needle);
  });
  const maxLoad = Math.max(...stats.data.loadFactorByRoute.map((item) => item.loadFactor ?? 0), 0.01);
  const waitMinutes =
    stats.data.averageWaitSeconds === null ? null : Math.round(stats.data.averageWaitSeconds / 60);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-bold">{t("admin.title")}</h1>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/insights"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line bg-card px-3.5 text-xs font-bold text-ink hover:border-taxi hover:bg-taxi/20 transition"
          >
            ⚡ AI Insights
          </Link>
          <Link
            href="/admin/appeals"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line bg-card px-3.5 text-xs font-bold text-ink hover:bg-sky/50 transition"
          >
            ⚖️ Controller Appeals
          </Link>
          <Link
            href="/admin/audit-log"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line bg-card px-3.5 text-xs font-bold text-ink hover:bg-sky/50 transition"
          >
            📜 Audit Trail
          </Link>
        </div>
      </div>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("admin.wait")} value={waitMinutes} suffix={t("admin.minutes")} />
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
              <div className="mb-1 flex justify-between gap-3 text-sm">
                <span>{routeName(item.route, lang)}</span>
                <span className="tabular-nums">
                  {item.loadFactor === null ? t("admin.noData") : `${Math.round(item.loadFactor * 100)}%`}
                  {" · "}
                  {t("admin.completedTrips", { n: item.completedTrips })}
                </span>
              </div>
              <div className="h-3 rounded-full bg-sky">
                <div
                  className="h-3 rounded-full bg-cobalt"
                  style={{ width: `${item.loadFactor === null ? 0 : (item.loadFactor / maxLoad) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t("admin.searchLabel")}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("admin.searchPlaceholder")}
            className="min-h-12 rounded-[14px] border-2 border-line bg-card px-4 focus:outline-none focus-visible:ring-4 focus-visible:ring-taxi"
          />
        </label>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("admin.filterAll")}>
          {(["ALL", "OPEN", "IN_REVIEW", "RESOLVED"] as const).map((status) => (
            <button
              key={status}
              type="button"
              aria-pressed={filter === status}
              className={`min-h-12 rounded-full px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-taxi ${filter === status ? "bg-cobalt text-white" : "border border-line bg-card"}`}
              onClick={() => setFilter(status)}
            >
              {status === "ALL" ? t("admin.filterAll") : t(`status.${status}`)}
            </button>
          ))}
        </div>
        {visible.length === 0 && <EmptyState title={t("admin.noReports")} />}
        <div className="grid gap-3 xl:grid-cols-2">
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
                <label className="flex flex-col gap-1.5 text-sm font-semibold">
                  {t("admin.note")}
                  <input
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    className="min-h-12 rounded-[14px] border-2 border-line px-3 font-normal focus:outline-none focus-visible:ring-4 focus-visible:ring-taxi"
                  />
                </label>
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
        </div>
      </section>

      {/* Live Fleet Overview Map */}
      <section className="rounded-[20px] bg-card p-5 shadow-card">
        <FleetMap className="h-80 w-full rounded-xl overflow-hidden" />
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
