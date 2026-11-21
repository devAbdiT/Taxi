"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { useT } from "@/lib/i18n";

interface CallControlsProps {
  seatsLeft: number;
  waiting: number;
  busy: boolean;
  /** `undefined` asks the API to fill every seat left. */
  onCall: (count: number | undefined) => void;
}

const stepButton =
  "flex size-12 items-center justify-center rounded-xl border-2 border-slate-800 bg-white text-2xl font-bold " +
  "hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400 " +
  "disabled:cursor-not-allowed disabled:opacity-40";

export function CallControls({ seatsLeft, waiting, busy, onCall }: CallControlsProps) {
  const t = useT();
  const [requested, setRequested] = useState<number | null>(null);
  const count = Math.min(requested ?? seatsLeft, seatsLeft);
  const willCall = Math.min(count, waiting);

  return (
    <div className="flex flex-col gap-3 rounded-xl border-2 border-blue-300 bg-blue-50 p-4">
      <p className="text-lg font-semibold">{t("driver.callTitle")}</p>
      {waiting === 0 ? (
        <p className="text-slate-800">{t("driver.nobodyWaiting")}</p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="whitespace-nowrap font-semibold">{t("driver.callCount")}</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label={t("driver.callFewer")}
                className={stepButton}
                disabled={count <= 1 || busy}
                onClick={() => setRequested(count - 1)}
              >
                −
              </button>
              <span aria-live="polite" className="w-10 text-center text-3xl font-bold tabular-nums">
                {count}
              </span>
              <button
                type="button"
                aria-label={t("driver.callMore")}
                className={stepButton}
                disabled={count >= seatsLeft || busy}
                onClick={() => setRequested(count + 1)}
              >
                +
              </button>
            </div>
          </div>
          <Button
            onClick={() => {
              onCall(count >= seatsLeft ? undefined : count);
              setRequested(null);
            }}
            loading={busy}
            fullWidth
          >
            {t("driver.callButton", { n: willCall })}
          </Button>
        </>
      )}
    </div>
  );
}
