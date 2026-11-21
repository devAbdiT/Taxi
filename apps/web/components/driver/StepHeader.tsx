"use client";

import { useT } from "@/lib/i18n";

export function StepHeader({ step, title }: { step: number; title: string }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">{t("driver.step", { n: step })}</p>
      <h2 className="text-xl font-bold leading-tight">{title}</h2>
    </div>
  );
}
