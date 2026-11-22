"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type GeolocationState = "unknown" | "granted" | "denied" | "unavailable";

export interface LocationData {
  lat: number;
  lng: number;
  accuracy: number;
  heading: number | null;
  speedKmh: number | null;
}

export function useGeolocation(onLocationChange?: (pos: LocationData) => void) {
  const [state, setState] = useState<GeolocationState>("unknown");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const lastEmitRef = useRef<number>(0);
  const callbackRef = useRef(onLocationChange);

  useEffect(() => {
    callbackRef.current = onLocationChange;
  }, [onLocationChange]);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const startWatching = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState("unavailable");
      setError("Geolocation is not supported by your browser");
      return;
    }

    stopWatching();

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy: acc, heading, speed } = pos.coords;
        if (acc > 200) {
          // Filter out positions with accuracy > 200m
          return;
        }

        const now = Date.now();
        if (now - lastEmitRef.current < 5000) {
          return;
        }
        lastEmitRef.current = now;

        setState("granted");
        setLat(latitude);
        setLng(longitude);
        setAccuracy(acc);
        setError(null);

        callbackRef.current?.({
          lat: latitude,
          lng: longitude,
          accuracy: acc,
          heading: heading ?? null,
          speedKmh: speed != null ? speed * 3.6 : null,
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setState("denied");
          setError("Location permission denied");
        } else {
          setError(err.message);
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      },
    );
  }, [stopWatching]);

  useEffect(() => {
    return () => {
      stopWatching();
    };
  }, [stopWatching]);

  return {
    state,
    lat,
    lng,
    accuracy,
    error,
    startWatching,
    stopWatching,
  };
}
