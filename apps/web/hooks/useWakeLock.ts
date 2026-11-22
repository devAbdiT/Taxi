"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useWakeLock() {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const requestedRef = useRef(false);

  useEffect(() => {
    if (typeof navigator !== "undefined" && "wakeLock" in navigator) {
      setSupported(true);
    }
  }, []);

  const request = useCallback(async () => {
    requestedRef.current = true;
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) {
      return;
    }
    try {
      const sentinel = await navigator.wakeLock.request("screen");
      wakeLockRef.current = sentinel;
      setActive(true);

      sentinel.addEventListener("release", () => {
        wakeLockRef.current = null;
        setActive(false);
      });
    } catch {
      setActive(false);
      wakeLockRef.current = null;
    }
  }, []);

  const release = useCallback(async () => {
    requestedRef.current = false;
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch {
        // ignore
      } finally {
        wakeLockRef.current = null;
        setActive(false);
      }
    }
  }, []);

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && requestedRef.current && !wakeLockRef.current) {
        await request();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLockRef.current) {
        void wakeLockRef.current.release();
      }
    };
  }, [request]);

  return {
    supported,
    active,
    request,
    release,
  };
}
