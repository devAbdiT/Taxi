"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { StatusBadge } from "@/components/StatusBadge";
import { RelativeTime } from "@/components/RelativeTime";
import { api, fetcher } from "@/lib/api";
import { routeName } from "@/lib/format";
import { useLanguage, useT } from "@/lib/i18n";
import type { AdminReport, AdminStatsResponse, ReportStatus } from "@/lib/types";

function waitText(seconds: number | null, t: (key: "admin.noWait" | "admin.minutes", vars?: { n: number }) => string) {
  if (seconds === null) return t("admin.noWait");
  return t("admin.minutes", { n: Math.max(1, Math.round(seconds / 60)) });
}

export default function AdminPage() {
  const t = useT();
  const lang = useLanguage();
  const stats = useSWR<AdminStatsResponse>("/admin/stats", fetcher);
  const reports = useSWR<AdminReport[]>("/admin/reports", fetcher);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function setStatus(report: AdminReport, status: ReportStatus) {
    setBusy(report.id);
    try {
      await api.updateReport(report.id, { status, resolutionNote: notes[report.id] });
      await reports.mutate();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {stats.error && !stats.data ? (
        <ErrorState error={stats.error} onRetry={() => stats.mutate()} />
      ) : !stats.data ? (
        <LoadingState />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <article className="rounded-2xl border-2 border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-600">{t("admin.averageWait")}</p>
              <p className="text-3xl font-bold">{waitText(stats.data.averageWaitSeconds, t)}</p>
            </article>
            <article className="rounded-2xl border-2 border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-600">{t("admin.tripsToday")}</p>
              <p className="text-3xl font-bold tabular-nums">{stats.data.tripsToday}</p>
            </article>
            <article className="col-span-2 rounded-2xl border-2 border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-600">{t("admin.waitingNow")}</p>
              <p className="text-3xl font-bold tabular-nums">{stats.data.waitingNow}</p>
            </article>
          </div>
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-bold">{t("admin.load")}</h2>
            {stats.data.loadFactorByRoute.length === 0 ? (
              <EmptyState title={t("admin.noTrips")} />
            ) : (
              stats.data.loadFactorByRoute.map((item) => (
                <p key={item.route.id} className="rounded-xl border-2 border-slate-200 bg-white p-3 text-lg">
                  <span className="font-semibold">{routeName(item.route, lang)}</span>
                  {" · "}
                  {item.loadFactor === null ? "–" : `${Math.round(item.loadFactor * 100)}%`}
                </p>
              ))
            )}
          </section>
        </>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">{t("admin.reports")}</h2>
        {reports.error && !reports.data ? (
          <ErrorState error={reports.error} onRetry={() => reports.mutate()} />
        ) : !reports.data ? (
          <LoadingState />
        ) : reports.data.length === 0 ? (
          <EmptyState title={t("admin.noReports")} />
        ) : (
          reports.data.map((report) => (
            <article key={report.id} className="flex flex-col gap-3 rounded-2xl border-2 border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="mr-auto font-semibold">{t(`reportType.${report.type}`)}</p>
                <StatusBadge status={report.status} />
              </div>
              <p>{report.description}</p>
              <p className="text-sm text-slate-600">
                {report.reporter.name}
                {report.taxiPlate ? ` · ${report.taxiPlate}` : ""} · <RelativeTime date={report.createdAt} />
              </p>
              <Field
                label={t("admin.note")}
                value={notes[report.id] ?? report.resolutionNote ?? ""}
                onChange={(event) => setNotes({ ...notes, [report.id]: event.target.value })}
              />
              <div className="grid grid-cols-1 gap-2">
                {report.status === "OPEN" && (
                  <Button onClick={() => setStatus(report, "IN_REVIEW")} loading={busy === report.id} fullWidth>
                    {t("admin.review")}
                  </Button>
                )}
                {report.status !== "RESOLVED" && (
                  <Button onClick={() => setStatus(report, "RESOLVED")} loading={busy === report.id} fullWidth>
                    {t("admin.resolve")}
                  </Button>
                )}
                {report.status === "RESOLVED" && (
                  <Button variant="secondary" onClick={() => setStatus(report, "OPEN")} loading={busy === report.id} fullWidth>
                    {t("admin.reopen")}
                  </Button>
                )}
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
