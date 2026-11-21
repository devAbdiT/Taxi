"use client";

import { Icon, type IconName } from "@/components/Icon";
import { useT } from "@/lib/i18n";
import type { QueueStatus, ReportStatus, TaxiStatus, TripStatus } from "@/lib/types";

export type BadgeStatus = QueueStatus | TripStatus | TaxiStatus | ReportStatus | "PRIORITY";

const tones = {
  amber: "border-amber-400 bg-amber-50 text-amber-950",
  blue: "border-blue-400 bg-blue-50 text-blue-950",
  green: "border-emerald-500 bg-emerald-50 text-emerald-950",
  gray: "border-slate-400 bg-slate-100 text-slate-900",
  red: "border-red-400 bg-red-50 text-red-950",
  purple: "border-violet-400 bg-violet-50 text-violet-950",
};

const config: Record<BadgeStatus, { icon: IconName; tone: keyof typeof tones }> = {
  WAITING: { icon: "clock", tone: "amber" },
  CALLED: { icon: "bell", tone: "blue" },
  BOARDED: { icon: "check", tone: "green" },
  CANCELLED: { icon: "x", tone: "gray" },
  NO_SHOW: { icon: "userX", tone: "red" },
  OFFLINE: { icon: "power", tone: "gray" },
  AT_STATION: { icon: "flag", tone: "green" },
  LOADING: { icon: "users", tone: "blue" },
  EN_ROUTE: { icon: "arrowRight", tone: "purple" },
  DEPARTED: { icon: "arrowRight", tone: "purple" },
  COMPLETED: { icon: "checkCircle", tone: "green" },
  OPEN: { icon: "alert", tone: "amber" },
  IN_REVIEW: { icon: "eye", tone: "blue" },
  RESOLVED: { icon: "checkCircle", tone: "green" },
  PRIORITY: { icon: "star", tone: "purple" },
};

/** Status is always icon + text, never colour alone. */
export function StatusBadge({ status }: { status: BadgeStatus }) {
  const t = useT();
  const { icon, tone } = config[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-sm font-semibold ${tones[tone]}`}
    >
      <Icon name={icon} className="size-4" />
      {t(`status.${status}`)}
    </span>
  );
}
