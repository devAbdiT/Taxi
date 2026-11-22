"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { LoadingState } from "@/components/States";
import { useToast } from "@/components/Providers";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { AdminAppealEntry } from "@/lib/types";

export default function AdminAppealsPage() {
  const t = useT();
  const toast = useToast();
  const [filterStatus, setFilterStatus] = useState<string>("OPEN");
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [decision, setDecision] = useState<"UPHELD" | "REVERSED">("REVERSED");
  const [adminNote, setAdminNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: appeals, mutate, isLoading } = useSWR<AdminAppealEntry[]>(
    `/admin/appeals?status=${filterStatus}`,
    () => api.adminAppeals(filterStatus || undefined),
    { refreshInterval: 5000 }
  );

  async function handleDecide(e: React.FormEvent) {
    e.preventDefault();
    if (!decidingId || adminNote.trim().length < 10) return;

    setSubmitting(true);
    try {
      await api.decideAppeal(decidingId, {
        status: decision,
        adminNote: adminNote.trim(),
      });
      toast(`Appeal ${decision.toLowerCase()} successfully`);
      setDecidingId(null);
      setAdminNote("");
      await mutate();
    } catch (err: any) {
      toast(err?.message ?? "Failed to record decision");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 max-w-5xl mx-auto w-full">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">
            Queue Controller Action Appeals
          </h1>
          <p className="text-xs text-muted">
            Independent administrative review for actions taken by station queue controllers.
          </p>
        </div>

        <div className="flex rounded-xl border border-line bg-card p-1">
          {["OPEN", "UPHELD", "REVERSED"].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilterStatus(status)}
              className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                filterStatus === status
                  ? "bg-taxi text-ink shadow-2xs"
                  : "text-muted hover:text-ink"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </header>

      {isLoading && !appeals ? (
        <LoadingState />
      ) : (appeals ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-card p-12 text-center">
          <Icon name="checkCircle" className="size-10 text-emerald-500" />
          <h3 className="mt-3 font-display text-base font-bold text-ink">No Appeals in this category</h3>
          <p className="mt-1 text-xs text-muted">All queue action appeals have been processed.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {(appeals ?? []).map((appeal) => (
            <div
              key={appeal.id}
              className="rounded-2xl border border-line bg-card p-5 shadow-xs flex flex-col gap-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                <div>
                  <h3 className="font-display text-base font-bold text-ink">
                    Appeal by {appeal.appellantFirstName} {appeal.action?.stationName ? `(${appeal.action.stationName})` : ""}
                  </h3>
                  <span className="text-xs text-muted">
                    Submitted on {new Date(appeal.createdAt).toLocaleString()}
                  </span>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  appeal.status === "OPEN"
                    ? "bg-amber-100 text-amber-900"
                    : appeal.status === "REVERSED"
                    ? "bg-emerald-100 text-emerald-900"
                    : "bg-red-100 text-red-900"
                }`}>
                  {appeal.status}
                </span>
              </div>

              {/* Side-by-side original action vs appeal reason */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-line bg-background p-3">
                  <span className="font-bold text-muted uppercase tracking-wider block mb-1">
                    Original Controller Action
                  </span>
                  {appeal.action ? (
                    <div>
                      <span className="font-semibold text-ink">
                        {appeal.action.action.replace(/_/g, " ")} by {appeal.action.actorFirstName}
                      </span>
                      <p className="mt-1 text-muted italic">&ldquo;{appeal.action.reason}&rdquo;</p>
                    </div>
                  ) : (
                    <p className="text-muted">Direct dispute appeal</p>
                  )}
                </div>

                <div className="rounded-xl border border-line bg-sky/30 p-3">
                  <span className="font-bold text-muted uppercase tracking-wider block mb-1">
                    Appellant&apos;s Stated Reason
                  </span>
                  <p className="text-ink">&ldquo;{appeal.reason}&rdquo;</p>
                </div>
              </div>

              {appeal.adminNote && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                  <strong>Admin Decision Note:</strong> {appeal.adminNote}
                </div>
              )}

              {appeal.status === "OPEN" && (
                <div className="mt-2 flex justify-end gap-2">
                  <Button
                    variant="accent"
                    onClick={() => {
                      setDecidingId(appeal.id);
                      setDecision("REVERSED");
                      setAdminNote("");
                    }}
                    className="text-xs py-2 px-4 min-h-9"
                  >
                    Decide Appeal
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Decision Modal */}
      {decidingId && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-line bg-card p-6 shadow-2xl">
            <h3 className="font-display text-lg font-bold text-ink">
              Decide Appeal
            </h3>
            <p className="mt-1 text-xs text-muted">
              Reversing an appeal restores sortKey position or lifts suspension immediately.
            </p>

            <form onSubmit={handleDecide} className="mt-4 flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-muted uppercase tracking-wider">
                  Decision
                </label>
                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDecision("REVERSED")}
                    className={`flex-1 rounded-xl py-2 text-xs font-bold border transition ${
                      decision === "REVERSED"
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-line bg-background text-muted"
                    }`}
                  >
                    REVERSE (Uphold Appeal)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecision("UPHELD")}
                    className={`flex-1 rounded-xl py-2 text-xs font-bold border transition ${
                      decision === "UPHELD"
                        ? "border-alert bg-alert text-white"
                        : "border-line bg-background text-muted"
                    }`}
                  >
                    UPHOLD (Reject Appeal)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted uppercase tracking-wider">
                  Admin Note (10–500 chars) *
                </label>
                <textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="State the administrative finding and basis for this decision..."
                  rows={4}
                  required
                  minLength={10}
                  maxLength={500}
                  className="mt-1 w-full rounded-xl border border-line bg-background p-3 text-sm text-ink focus:border-taxi focus:outline-none"
                />
                <div className="text-right text-xs text-muted mt-1">{adminNote.length}/500</div>
              </div>

              <div className="mt-2 flex gap-2">
                <Button
                  type="submit"
                  variant="accent"
                  fullWidth
                  loading={submitting}
                  disabled={adminNote.trim().length < 10}
                >
                  Submit Decision
                </Button>
                <button
                  type="button"
                  onClick={() => setDecidingId(null)}
                  disabled={submitting}
                  className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-muted hover:text-ink hover:bg-black/5"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
