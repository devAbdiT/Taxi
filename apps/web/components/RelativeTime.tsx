"use client";

import { useRelativeTime } from "@/lib/time";

export function RelativeTime({ date }: { date: string }) {
  const relative = useRelativeTime();
  return <time dateTime={date}>{relative(date) || "\u00a0"}</time>;
}
