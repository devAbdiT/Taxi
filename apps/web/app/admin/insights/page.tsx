"use client";

import { useState } from "react";
import useSWR from "swr";
import { Icon } from "@/components/Icon";
import { LoadingState } from "@/components/States";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { InsightsResponse } from "@/lib/types";

export default function AdminInsightsPage() {
  const t = useT();
  const [days, setDays] = useState(7);
  const [activeTab, setActiveTab] = useState<"overview" | "hotspots" | "suggestions">("overview");

  const { data: insights, error, isLoading } = useSWR<InsightsResponse>(
    `/admin/ai/insights?days=${days}`,
    () => api.aiInsights(days),
    { refreshInterval: 60000 }
  );

  if (isLoading || !insights) return <LoadingState />;

  const topIssues = insights.topIssues ?? [];
  const hotspots = insights.hotspots ?? [];
  const suggestions = insights.suggestions ?? [];

  return (
    <div className="flex flex-col gap-6 p-4 max-w-6xl mx-auto w-full">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-ink">
              {t("ai.insightsTitle", "AI Operational Insights")}
            </h1>
            <span className="rounded-full bg-taxi/30 px-2.5 py-0.5 text-xs font-bold text-ink">
              ⚡ {insights.method.toUpperCase()}
            </span>
            {insights.synthetic && (
              <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-muted">
                {t("ai.demoData", "Demo data")}
              </span>
            )}
          </div>
          <p className="text-xs text-muted mt-0.5">
            Analyzed {insights.basedOnSamples} disputes and reports over the last {insights.days} days.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-muted">Period:</label>
          <div className="flex rounded-xl border border-line bg-card p-1">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                  days === d
                    ? "bg-taxi text-ink shadow-2xs"
                    : "text-muted hover:text-ink"
                }`}
              >
                {d} days
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Navigation tabs */}
      <div className="flex border-b border-line gap-2" role="tablist">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition ${
            activeTab === "overview"
              ? "border-taxi text-ink"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          {t("ai.topIssues", "Top Station Issues")}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("hotspots")}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition ${
            activeTab === "hotspots"
              ? "border-taxi text-ink"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          {t("ai.hotspots", "Dispute Hotspots")}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("suggestions")}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition ${
            activeTab === "suggestions"
              ? "border-taxi text-ink"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          {t("ai.suggestions", "Suggestions")} ({suggestions.length})
        </button>
      </div>

      {/* TAB: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-line bg-card p-5 shadow-xs">
            <h2 className="font-display text-base font-bold text-ink mb-3">
              Top Queue Issues & Trends
            </h2>

            {topIssues.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">No disputes recorded in this period.</p>
            ) : (
              <div className="divide-y divide-line">
                {topIssues.map((issue) => (
                  <div key={`${issue.source}-${issue.type}`} className="flex items-center justify-between py-3">
                    <div>
                      <span className="font-semibold text-ink text-sm">
                        {issue.type.replace(/_/g, " ")}
                      </span>
                      <span className="ml-2 rounded-full bg-ink/10 px-2 py-0.5 text-[10px] font-bold text-muted uppercase">
                        {issue.source}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-bold text-ink">{issue.count} incidents</span>
                      <span
                        className={`inline-flex items-center gap-0.5 text-xs font-bold ${
                          issue.change > 0 ? "text-alert" : issue.change < 0 ? "text-emerald-600" : "text-muted"
                        }`}
                      >
                        {issue.change > 0 ? "↑" : issue.change < 0 ? "↓" : "="} {Math.abs(issue.change)} vs prev
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-card p-5 shadow-xs flex items-center justify-between">
            <div>
              <h3 className="font-display text-sm font-bold text-ink">Repeat Offender Monitoring</h3>
              <p className="text-xs text-muted mt-0.5">
                Passengers or drivers with 3+ filed disputes in this period (IDs masked for privacy)
              </p>
            </div>
            <span className="rounded-full bg-amber-100 px-3 py-1 font-mono text-sm font-bold text-amber-900 border border-amber-300">
              {insights.repeatOffenders.count} flagged
            </span>
          </div>
        </div>
      )}

      {/* TAB: HOTSPOTS */}
      {activeTab === "hotspots" && (
        <div className="rounded-2xl border border-line bg-card p-5 shadow-xs flex flex-col gap-4">
          <div>
            <h2 className="font-display text-base font-bold text-ink">
              Hourly Dispute Density Matrix
            </h2>
            <p className="text-xs text-muted">
              Identifies peak hours and stations where queues encounter the most friction.
            </p>
          </div>

          {hotspots.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No hotspot patterns detected.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-line bg-background text-muted">
                    <th className="py-2.5 px-3 font-bold">Station</th>
                    <th className="py-2.5 px-3 font-bold">Peak Hour</th>
                    <th className="py-2.5 px-3 font-bold">Disputes</th>
                    <th className="py-2.5 px-3 font-bold">Top Issue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {hotspots.map((h, i) => (
                    <tr key={`${h.stationId}-${h.hour}-${i}`} className="hover:bg-sky/20">
                      <td className="py-2.5 px-3 font-bold text-ink">{h.stationName}</td>
                      <td className="py-2.5 px-3 font-mono">
                        {h.hour}:00 – {h.hour + 1}:00
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="rounded-full bg-red-100 px-2 py-0.5 font-bold text-red-800">
                          {h.disputes} disputes
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-muted">
                        {h.topType ? h.topType.replace(/_/g, " ") : "General"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB: SUGGESTIONS */}
      {activeTab === "suggestions" && (
        <div className="flex flex-col gap-3">
          {suggestions.map((suggestion, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 rounded-2xl border border-line bg-card p-4 shadow-xs"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-taxi/30 text-ink font-bold">
                💡
              </span>
              <div>
                <h3 className="font-display text-sm font-bold text-ink">Action Recommendation</h3>
                <p className="mt-1 text-sm text-muted leading-relaxed">{suggestion}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* HOW THIS IS CALCULATED (EXPANDABLE) */}
      <details className="rounded-2xl border border-line bg-card p-4 text-xs text-muted shadow-xs">
        <summary className="font-bold text-ink cursor-pointer hover:text-taxi">
          ℹ️ {t("ai.howCalculated", "How this is calculated")}
        </summary>
        <div className="mt-3 leading-relaxed flex flex-col gap-1.5 border-t border-line pt-3">
          <p>
            <strong>Method:</strong> Rules-based pattern extraction on historical reports, controller actions, and disputes.
          </p>
          <p>
            <strong>Data sources:</strong> Station queue entry timestamps, priority claims, controller reorder events, and disputes filed in Jimma.
          </p>
          <p>
            <strong>Privacy guarantees:</strong> No passenger phone numbers, full names, or individual identities are ever analyzed or returned.
          </p>
        </div>
      </details>
    </div>
  );
}
