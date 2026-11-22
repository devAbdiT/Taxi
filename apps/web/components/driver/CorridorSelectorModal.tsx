"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/Button";
import { ChoiceCard } from "@/components/ChoiceCard";
import { ErrorState, FormError, LoadingState } from "@/components/States";
import { api, fetcher } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { DriverCorridor, DriverCorridorResponse } from "@/lib/types";

interface CorridorSelectorModalProps {
  currentCorridor?: DriverCorridor | null;
  onSelect?: () => Promise<unknown> | void;
}

export function CorridorSelectorModal({ currentCorridor, onSelect }: CorridorSelectorModalProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, error: fetchError, mutate } = useSWR<DriverCorridorResponse>(
    open ? "/driver/corridor" : null,
    fetcher,
  );

  async function handleSave() {
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    try {
      await api.setDriverCorridor({ corridorId: selectedId });
      await onSelect?.();
      await mutate();
      setOpen(false);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSelectedId(currentCorridor?.id ?? null);
          setOpen(true);
        }}
        className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-ink hover:bg-card hover:border-ink/30 transition"
      >
        🔄 {t("driver.changeCorridor", "Change corridor")}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        >
          <div className="flex max-h-[90vh] w-full max-w-md flex-col gap-4 rounded-3xl bg-card p-6 shadow-modal border border-line overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">{t("driver.chooseCorridor", "Select assigned corridor")}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="size-8 rounded-full text-lg font-bold text-muted hover:bg-surface"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-muted">
              {t(
                "driver.corridorHint",
                "Drivers are assigned to operate back-and-forth along a single 2-station corridor.",
              )}
            </p>

            {fetchError ? (
              <ErrorState error={fetchError} onRetry={() => mutate()} />
            ) : !data ? (
              <LoadingState />
            ) : (
              <fieldset className="flex flex-col gap-2">
                {data.available.map((c) => {
                  const isCurrent = c.id === (selectedId ?? currentCorridor?.id);
                  return (
                    <ChoiceCard
                      key={c.id}
                      name="corridor"
                      value={c.id}
                      checked={isCurrent}
                      onSelect={() => setSelectedId(c.id)}
                    >
                      <div className="flex flex-col">
                        <span className="text-base font-semibold">{c.name}</span>
                        <span className="text-xs text-muted">2 reciprocal routes</span>
                      </div>
                    </ChoiceCard>
                  );
                })}
              </fieldset>
            )}

            <FormError error={error} />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                loading={saving}
                disabled={!selectedId || selectedId === currentCorridor?.id}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
