"use client";

import { useT } from "@/lib/i18n";

export function AnimatedNumber({ value }: { value: number }) {
  return (
    <span key={value} className="roll font-display tabular-nums">
      {value}
    </span>
  );
}

export function LiveIndicator({ live = true }: { live?: boolean }) {
  const t = useT();
  return (
    <span className="inline-flex min-h-8 items-center gap-2 rounded-full bg-go-soft px-3 text-sm font-semibold text-go">
      <span className={`size-2.5 rounded-full ${live ? "bg-go pulse-ring" : "bg-taxi"}`} />
      {live ? t("live.live") : t("live.reconnecting")}
    </span>
  );
}

export function RouteLine({ from, to, light = false }: { from: string; to: string; light?: boolean }) {
  const stroke = light ? "#F5B800" : "#1D4E9E";
  return (
    <div className="flex items-center gap-2">
      <span className="font-semibold">{from}</span>
      <svg viewBox="0 0 120 24" className="h-6 flex-1" aria-hidden>
        <line x1="4" y1="18" x2="116" y2="18" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
        <circle cx="8" cy="18" r="4" fill="#F5B800" />
        <circle cx="112" cy="18" r="4" fill={light ? "#FFFFFF" : "#1D4E9E"} />
        <rect x="48" y="6" width="22" height="12" rx="3" fill="#F5B800" />
        <circle cx="53" cy="18" r="2.5" fill="#0E1B33" />
        <circle cx="65" cy="18" r="2.5" fill="#0E1B33" />
      </svg>
      <span className="font-semibold">{to}</span>
    </div>
  );
}

export function ProgressRing({ value, label }: { value: number; label: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(value, 12) / 12);
  return (
    <div className="relative mx-auto grid size-40 place-items-center">
      <svg viewBox="0 0 140 140" className="absolute size-40 -rotate-90">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#E6E1D6" strokeWidth="10" />
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="#1D4E9E"
          strokeWidth="10"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="text-center">
        <p className="text-sm text-muted">{label}</p>
        <p className="font-display text-5xl font-bold tabular-nums text-cobalt">{value}</p>
      </div>
    </div>
  );
}

export function SeatGrid({ used, capacity }: { used: number; capacity: number }) {
  return (
    <div className="grid grid-cols-9 gap-1" aria-hidden>
      {Array.from({ length: capacity }, (_, index) => (
        <span key={index} className={`h-3 rounded-sm ${index < used ? "bg-go" : "bg-line"}`} />
      ))}
    </div>
  );
}

export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const step = 120 / (values.length - 1);
  const points = values.map((value, index) => `${index * step},${32 - (value / max) * 28}`).join(" ");
  return (
    <svg viewBox="0 0 120 36" className="h-10 w-full" aria-hidden>
      <polyline fill="none" stroke="#1D4E9E" strokeWidth="2.5" points={points} />
    </svg>
  );
}
