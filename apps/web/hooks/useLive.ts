"use client";

import { useEffect } from "react";
import { useSWRConfig } from "swr";
import { SOCKET_URL, USE_MOCKS } from "@/lib/config";
import { getToken } from "@/lib/api";
import { subscribe } from "@/lib/live/bus";

/**
 * Revalidates SWR when the mock bus fires.
 * When mocks are off, the same refresh listens to Socket.IO (not exercised in this UI pass).
 */
export function useLive() {
  const { mutate } = useSWRConfig();

  useEffect(() => {
    const refresh = () => {
      void mutate(() => true);
    };
    if (USE_MOCKS) {
      return subscribe("*", refresh);
    }

    let socket: { close: () => void } | null = null;
    let cancelled = false;
    void import("socket.io-client").then(({ io }) => {
      if (cancelled) return;
      const client = io(SOCKET_URL, {
        path: "/socket.io",
        auth: { token: getToken() },
        transports: ["websocket"],
      });
      client.on("demand:update", refresh);
      client.on("queue:update", refresh);
      client.on("notification:new", refresh);
      client.on("trip:update", refresh);
      socket = client;
    }).catch(() => undefined);

    return () => {
      cancelled = true;
      socket?.close();
    };
  }, [mutate]);
}
