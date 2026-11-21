"use client";

import { useSyncExternalStore } from "react";
import type { TKey, TVars } from "@/lib/i18n";

type Translate = (key: TKey, vars?: TVars) => string;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Always relative text: many users read a clock six hours offset from the international one. */
export function formatRelative(date: string | Date, now: number, t: Translate): string {
  const diff = now - new Date(date).getTime();
  if (diff < MINUTE) return t("time.justNow");
  if (diff < HOUR) return t("time.minutesAgo", { n: Math.floor(diff / MINUTE) });
  if (diff < DAY) return t("time.hoursAgo", { n: Math.floor(diff / HOUR) });
  return t("time.daysAgo", { n: Math.floor(diff / DAY) });
}

const TICK_MS = 30_000;
const listeners = new Set<() => void>();
let now = 0;
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(onChange: () => void) {
  if (listeners.size === 0) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((notify) => notify());
    }, TICK_MS);
  }
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) clearInterval(timer);
  };
}

function getSnapshot() {
  if (now === 0) now = Date.now();
  return now;
}

/** Shared clock that ticks every 30 seconds. Returns 0 during server rendering. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, () => 0);
}
