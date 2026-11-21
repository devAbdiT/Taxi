"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { errorMessage } from "@/lib/errors";
import { useT } from "@/lib/i18n";

export function LoadingState({ label }: { label?: string }) {
  const t = useT();
  const text = label ?? t("common.loading");
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3 py-2">
      <span className="sr-only">{text}</span>
      <div className="shimmer h-28 rounded-[20px]" />
      <div className="shimmer h-28 w-4/5 rounded-[20px]" />
    </div>
  );
}

export function EmptyState({ title, action }: { title?: string; action?: ReactNode }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-4 rounded-[20px] border-2 border-dashed border-line bg-card px-4 py-10 text-center">
      <Icon name="inbox" className="size-8 text-muted" />
      <p className="text-lg text-ink">{title ?? t("common.empty")}</p>
      {action}
    </div>
  );
}

/** Inline error under a form; renders nothing when there is no error. */
export function FormError({ error }: { error: unknown }) {
  const t = useT();
  if (!error) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-xl border-2 border-red-300 bg-red-50 p-3 text-red-900">
      <Icon name="alert" className="mt-0.5 size-5" />
      {errorMessage(error, t)}
    </p>
  );
}

export function ErrorState({ error, onRetry }: { error?: unknown; onRetry?: () => void }) {
  const t = useT();
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 rounded-2xl border-2 border-red-300 bg-red-50 px-4 py-8 text-center"
    >
      <div className="flex items-center gap-2 text-red-900">
        <Icon name="alert" className="size-6" />
        <p className="text-lg font-medium">{errorMessage(error, t)}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
}
