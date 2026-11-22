"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { useT } from "@/lib/i18n";
import { api } from "@/lib/api";
import { useToast } from "@/components/Providers";
import type { ControllerActionType } from "@/lib/types";

export interface ActionSheetTarget {
  name: string;
  queueEntryId?: string;
  driverQueueEntryId?: string;
  targetUserId?: string;
  disputeId?: string;
}

interface ActionSheetProps {
  open: boolean;
  action: ControllerActionType;
  target: ActionSheetTarget;
  onClose: () => void;
  onSuccess: () => void;
}

const QUICK_REASONS: Record<string, string[]> = {
  WARN: [
    "Line cutting attempt observed",
    "Disruptive behavior at the queue",
    "Failure to present required priority documentation",
  ],
  MOVE_BACK: [
    "Attempted line jumping",
    "Stepped out of queue without notification",
    "Fairness adjustment requested by crowd",
  ],
  MOVE_FORWARD: [
    "Queue adjustment after mistaken delay",
    "Position correction by controller",
    "Authorized assistance adjustment",
  ],
  CONFIRM_PRIORITY: [
    "Elderly passenger with valid verification",
    "Mobility assistance verified",
    "Verified pregnant passenger",
  ],
  REJECT_PRIORITY: [
    "No valid priority document presented",
    "False claim of priority category",
    "Priority quota exceeded for this group",
  ],
  MARK_NO_SHOW: [
    "Did not respond after 3 calls",
    "Left boarding area when taxi arrived",
  ],
  REMOVE: [
    "Passenger voluntarily cancelled with controller",
    "Repeated non-compliance with station queue rules",
  ],
  SUSPEND: [
    "Aggressive behavior towards passengers or staff",
    "Repeated intentional line cutting",
    "Refusal to follow queue controller safety instructions",
  ],
  ALLOW_OUT_OF_TURN: [
    "Special assistance trip assigned",
    "Breakdown replacement vehicle",
    "Authorized station balance run",
  ],
  REORDER_DRIVER: [
    "Driver rotation adjustment",
    "Station capacity balancing",
  ],
};

export function ActionSheet({ open, action, target, onClose, onSuccess }: ActionSheetProps) {
  const t = useT();
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [positions, setPositions] = useState(1);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const quickChips = QUICK_REASONS[action] ?? [
    "Fairness protocol applied by queue controller",
    "Manual order adjustment by station controller",
  ];

  const minChars = 10;
  const maxChars = 500;
  const isValidReason = reason.trim().length >= minChars && reason.length <= maxChars;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidReason) return;

    setLoading(true);
    try {
      await api.stationAction({
        action: action as any,
        reason: reason.trim(),
        queueEntryId: target.queueEntryId,
        driverQueueEntryId: target.driverQueueEntryId,
        targetUserId: target.targetUserId,
        disputeId: target.disputeId,
        minutes: action === "SUSPEND" ? minutes : undefined,
        positions: action === "MOVE_BACK" || action === "MOVE_FORWARD" || action === "REORDER_DRIVER" ? positions : undefined,
      });
      toast(t("station.action.success", "Action applied successfully"));
      onSuccess();
      onClose();
    } catch (err: any) {
      toast(err?.message ?? t("common.error", "Action failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-xs transition-opacity sm:items-center sm:p-4"
    >
      <div className="w-full max-w-lg rounded-t-[28px] border border-line bg-card p-6 shadow-2xl transition-all sm:rounded-[24px]">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-taxi/20 text-ink">
              <Icon name="flag" className="size-4" />
            </span>
            <h2 className="font-display text-lg font-bold text-ink">
              {action.replace(/_/g, " ")} — {target.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted hover:bg-black/5 hover:text-ink"
            aria-label="Close"
          >
            <Icon name="x" className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          {action === "SUSPEND" && (
            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wider">
                {t("station.action.duration", "Suspension Duration")}
              </label>
              <select
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-line bg-background p-3 text-sm text-ink focus:border-taxi focus:outline-none"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={180}>3 hours</option>
                <option value={1440}>24 hours</option>
              </select>
            </div>
          )}

          {(action === "MOVE_BACK" || action === "MOVE_FORWARD") && (
            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wider">
                {t("station.action.positions", "Number of positions to move")}
              </label>
              <div className="mt-1 flex gap-2">
                {[1, 2, 3, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPositions(n)}
                    className={`flex-1 rounded-xl py-2 text-sm font-bold border transition ${
                      positions === n
                        ? "border-taxi bg-taxi text-ink"
                        : "border-line bg-card text-muted hover:text-ink"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-muted uppercase tracking-wider">
                {t("station.action.reasonRequired", "Reason (Required, 10–500 chars)")} *
              </label>
              <span className={reason.length < minChars || reason.length > maxChars ? "text-alert font-bold" : "text-muted"}>
                {reason.length}/{maxChars}
              </span>
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("station.action.reasonPlaceholder", "State the specific reason for this queue action...")}
              rows={3}
              required
              minLength={minChars}
              maxLength={maxChars}
              className="mt-1.5 w-full rounded-xl border border-line bg-background p-3 text-sm text-ink focus:border-taxi focus:outline-none"
            />
          </div>

          <div>
            <span className="text-xs text-muted font-medium">
              {t("station.action.quickReasons", "Quick chips:")}
            </span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {quickChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setReason(chip)}
                  className="rounded-full border border-line bg-sky/40 px-3 py-1 text-xs text-ink hover:border-taxi hover:bg-taxi/20 transition"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <Button
              type="submit"
              variant="accent"
              fullWidth
              loading={loading}
              disabled={!isValidReason}
            >
              {t("common.confirm", "Confirm Action")}
            </Button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="inline-flex min-h-12 items-center justify-center rounded-[14px] px-4 text-sm font-semibold text-muted hover:bg-black/5 hover:text-ink transition"
            >
              {t("common.cancel", "Cancel")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
