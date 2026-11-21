"use client";

import Link from "next/link";
import { useEffect } from "react";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { USE_MOCKS } from "@/lib/config";
import { useLanguage, useT } from "@/lib/i18n";

export function Header() {
  const t = useT();
  const lang = useLanguage();

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <header className="border-b-2 border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-3 px-4 py-2">
        <Link href="/" className="flex min-h-12 flex-col justify-center rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400">
          <span className="text-xl font-bold leading-tight text-emerald-800">{t("app.name")}</span>
          <span className="text-sm leading-tight text-slate-700">{t("app.tagline")}</span>
        </Link>
        <LanguageSwitch />
      </div>
      {USE_MOCKS && (
        <p className="bg-amber-100 px-4 py-1 text-center text-xs font-semibold text-amber-950">
          {t("app.demoData")}
        </p>
      )}
    </header>
  );
}
