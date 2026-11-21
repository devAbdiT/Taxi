"use client";

import { useT } from "@/lib/i18n";
import { formatRelative, useNow } from "@/lib/time";

export function RelativeTime({ date }: { date: string }) {
  const t = useT();
  const now = useNow();
  return <time dateTime={date}>{now ? formatRelative(date, now, t) : "\u00a0"}</time>;
}
