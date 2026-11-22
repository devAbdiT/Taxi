"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { useT } from "@/lib/i18n";
import { gpsAiApi } from "@/lib/gpsAiApi";

const STORAGE_KEY = "taxiflow.locationConsent";
const SESSION_DISMISSED_KEY = "taxiflow.locationConsentDismissed";

export function LocationConsentSheet() {
  const t = useT();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const consented = localStorage.getItem(STORAGE_KEY) === "true";
      const dismissed = sessionStorage.getItem(SESSION_DISMISSED_KEY) === "true";
      if (!consented && !dismissed) {
        setOpen(true);
      }
    } catch {
      // Ignore storage access errors in private mode
    }
  }, []);

  if (!mounted || !open) return null;

  async function handleAccept() {
    setLoading(true);
    try {
      await gpsAiApi.setLocationConsent({ granted: true });
      localStorage.setItem(STORAGE_KEY, "true");
      setOpen(false);
    } catch (err) {
      console.error("Failed to set location consent", err);
      // Still store consent locally so user is not blocked
      localStorage.setItem(STORAGE_KEY, "true");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  function handleDismiss() {
    try {
      sessionStorage.setItem(SESSION_DISMISSED_KEY, "true");
    } catch {
      // Ignore
    }
    setOpen(false);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-xs transition-opacity duration-200 sm:p-4"
    >
      <div className="w-full max-w-lg rounded-t-[28px] border border-line bg-card p-6 shadow-2xl transition-transform duration-300 sm:rounded-[24px]">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-taxi/20 text-ink">
            <Icon name="flag" className="size-5" />
          </div>
          <h2 id="consent-title" className="font-display text-xl font-bold text-ink">
            {t("consent.title")}
          </h2>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-muted">
          {t("consent.body")}
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <Button
            variant="accent"
            fullWidth
            onClick={handleAccept}
            loading={loading}
          >
            {t("consent.accept")}
          </Button>

          <button
            type="button"
            onClick={handleDismiss}
            disabled={loading}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-[14px] px-4 text-sm font-semibold text-muted hover:text-ink hover:bg-black/5 active:scale-[.98] transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-taxi"
          >
            {t("consent.notNow")}
          </button>
        </div>
      </div>
    </div>
  );
}
