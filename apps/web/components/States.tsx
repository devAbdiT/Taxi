"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { errorMessage } from "@/lib/errors";
import { useT } from "@/lib/i18n";

export function LoadingState({ label }: { label?: string }) {
  const t = useT();
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-10 text-lg text-slate-700">
      <Icon name="spinner" className="size-6 animate-spin" />
      <span>{label ?? t("common.loading")}</span>
    </div>
  );
}

export function EmptyState({ title, action }: { title?: string; action?: ReactNode }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-slate-300 px-4 py-10 text-center">
      <Icon name="inbox" className="size-8 text-slate-500" />
      <p className="text-lg text-slate-700">{title ?? t("common.empty")}</p>
      {action}
    </div>
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
