"use client";

import { useSyncExternalStore } from "react";

let connected = false;
const listeners = new Set<() => void>();

/** Called by the socket hook so screens can show "Live" or "Reconnecting". */
export function setConnected(value: boolean) {
  if (connected === value) return;
  connected = value;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useConnected(): boolean {
  return useSyncExternalStore(subscribe, () => connected, () => false);
}
