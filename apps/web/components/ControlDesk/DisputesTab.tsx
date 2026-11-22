"use client";

import { useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { Button } from "@/components/Button";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/Providers";
import { api } from "@/lib/api";
import type { Dispute, DisputeType } from "@/lib/types";

interface DisputesTabProps {
  data: Dispute[];
  onActionSuccess: () => void;
}

const TYPE_ICONS: Record<DisputeType, IconName> = {
  LINE_JUMPING: "alert",
  PRIORITY_CLAIM: "star",
  DRIVER_SKIPPED_TURN: "car",
  FARE_DISPUTE: "flag",
  BEHAVIOR: "userX",
  OTHER: "info",
};

export function DisputesTab({ data, onActionSuccess }: DisputesTabProps) {
  const t = useT();
  const toast = useToast();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [loading, setLoading] = useState(false);

  const disputes = data ?? [];

  async function handleStatusChange(id: string, status: "IN_REVIEW") {
    try {
      await api.updateDispute(id, { status });
      toast(t("station.dispute.updated", "Dispute marked in review"));
      onActionSuccess();
    } catch (err: any) {
      toast(err?.message ?? t("common.error", "Update failed"));
    }
  }

  async function handleResolve(e: React.FormEvent) {
    e.preventDefault();
    if (!resolvingId || resolutionNote.trim().length < 10) return;

    setLoading(true);
    try {
      await api.updateDispute(resolvingId, {
        status: "RESOLVED",
        resolutionNote: resolutionNote.trim(),
      });
      toast(t("station.dispute.resolved", "Dispute resolved"));
      setResolvingId(null);
      setResolutionNote("");
      onActionSuccess();
    } catch (err: any) {
      toast(err?.message ?? t("common.error", "Resolution failed"));
    } finally {
      setLoading(false);
    }
  }

  if (disputes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-card p-12 text-center">
        <Icon name="checkCircle" className="size-10 text-emerald-500" />
        <h3 className="mt-3 font-display text-lg font-bold text-ink">
          {t("station.disputes.empty", "No Active Disputes")}
        </h3>
        <p className="mt-1 text-sm text-muted">
          {t("station.disputes.emptyDesc", "All passenger and driver reports have been resolved.")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {disputes.map((dispute) => {
        const icon = TYPE_ICONS[dispute.type] ?? "alert";
        const isResolved = dispute.status === "RESOLVED";

        return (
          <div
            key={dispute.id}
            className="rounded-2xl border border-line bg-card p-5 shadow-xs transition hover:shadow-md"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-full bg-red-100 text-red-700">
                  <Icon name={icon} className="size-4" />
                </span>
                <div>
                  <h3 className="font-display text-base font-bold text-ink">
                    {dispute.type.replace(/_/g, " ")}
                  </h3>
                  <span className="text-xs text-muted">
                    {t("station.disputes.openedBy", "Filed by")} {dispute.openedByFirstName ?? "Passenger"}
                    {dispute.againstFirstName ? ` vs. ${dispute.againstFirstName}` : ""}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  dispute.status === "RESOLVED"
                    ? "bg-emerald-100 text-emerald-800"
                    : dispute.status === "IN_REVIEW"
                    ? "bg-sky text-ink"
                    : "bg-red-100 text-red-800"
                }`}>
                  {dispute.status}
                </span>
                <span className="text-xs text-muted">
                  {new Date(dispute.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>

            <p className="mt-3 text-sm text-ink leading-relaxed">
              {dispute.description}
            </p>

            {dispute.resolutionNote && (
              <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900">
                <span className="font-bold">{t("station.dispute.resolution", "Resolution:")}</span>{" "}
                {dispute.resolutionNote}
              </div>
            )}

            {!isResolved && (
              <div className="mt-4 flex gap-2">
                {dispute.status === "OPEN" && (
                  <button
                    type="button"
                    onClick={() => handleStatusChange(dispute.id, "IN_REVIEW")}
                    className="rounded-xl border border-line bg-card px-4 py-2 text-xs font-semibold text-ink hover:bg-sky/50 transition"
                  >
                    {t("station.dispute.markInReview", "Mark In Review")}
                  </button>
                )}

                <Button
                  variant="accent"
                  onClick={() => {
                    setResolvingId(dispute.id);
                    setResolutionNote("");
                  }}
                  className="text-xs py-2 px-4 min-h-9"
                >
                  {t("station.dispute.resolve", "Resolve Dispute")}
                </Button>
              </div>
            )}
          </div>
        );
      })}

      {resolvingId && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl border border-line bg-card p-6 shadow-2xl">
            <h3 className="font-display text-lg font-bold text-ink">
              {t("station.dispute.resolveModalTitle", "Resolve Dispute")}
            </h3>
            <p className="mt-1 text-xs text-muted">
              {t("station.dispute.resolveModalDesc", "Provide a clear note explaining the resolution to both parties (10–500 chars).")}
            </p>

            <form onSubmit={handleResolve} className="mt-4 flex flex-col gap-3">
              <textarea
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="Reasonable resolution reached. Both parties agreed to..."
                rows={4}
                required
                minLength={10}
                maxLength={500}
                className="w-full rounded-xl border border-line bg-background p-3 text-sm text-ink focus:border-taxi focus:outline-none"
              />
              <div className="text-right text-xs text-muted">
                {resolutionNote.length}/500
              </div>

              <div className="mt-2 flex gap-2">
                <Button
                  type="submit"
                  variant="accent"
                  fullWidth
                  loading={loading}
                  disabled={resolutionNote.trim().length < 10}
                >
                  {t("common.save", "Save Resolution")}
                </Button>
                <button
                  type="button"
                  onClick={() => setResolvingId(null)}
                  disabled={loading}
                  className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-muted hover:text-ink hover:bg-black/5"
                >
                  {t("common.cancel", "Cancel")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
