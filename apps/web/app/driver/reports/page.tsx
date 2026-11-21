"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/Button";
import { useToast } from "@/components/Providers";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { StatusBadge } from "@/components/StatusBadge";
import { api, fetcher } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { Report } from "@/lib/types";

export default function DriverReportsPage() {
  const t = useT();
  const toast = useToast();
  const reports = useSWR<Report[]>("/driver/reports", fetcher);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function respond(id: string) {
    setBusy(id);
    try {
      await api.respondToReport(id, { response: text });
      toast(t("driver.responseSent"));
      setText("");
      await reports.mutate();
    } catch (error) {
      toast(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(null);
    }
  }

  if (reports.error && !reports.data) return <ErrorState error={reports.error} onRetry={() => reports.mutate()} />;
  if (!reports.data) return <LoadingState />;
  if (reports.data.length === 0) return <EmptyState title={t("driver.noReports")} />;

  return (
    <section className="flex flex-col gap-3">
      <h1 className="font-display text-3xl font-bold">{t("nav.reports")}</h1>
      {reports.data.map((report) => (
        <article key={report.id} className="rounded-[20px] bg-card p-4 shadow-card">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold">{t(`report.${report.type}`)}</p>
            <StatusBadge status={report.status} />
          </div>
          <p className="mt-2">{report.description}</p>
          {report.driverResponse ? (
            <p className="mt-2 text-sm text-go">{report.driverResponse}</p>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              <textarea value={text} onChange={(event) => setText(event.target.value)} className="min-h-20 rounded-[14px] border border-line p-3" />
              <Button disabled={text.trim().length < 3} loading={busy === report.id} onClick={() => void respond(report.id)}>
                {t("driver.respond")}
              </Button>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
