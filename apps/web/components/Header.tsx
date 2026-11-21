"use client";

import Link from "next/link";
import { useEffect } from "react";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { Logo } from "@/components/Logo";
import { LiveIndicator } from "@/components/kit";
import { USE_MOCKS } from "@/lib/config";
import { useLanguage, useT } from "@/lib/i18n";

export function Header() {
  const t = useT();
  const lang = useLanguage();

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <header className="border-b border-line bg-card">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-[14px] focus:bg-taxi focus:px-4 focus:py-3 focus:font-semibold"
      >
        {t("common.skip")}
      </a>
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-2">
        <Link href="/" aria-label="MengedLink" className="flex min-h-12 items-center rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-taxi">
          <Logo className="h-14 w-auto sm:h-16" priority />
        </Link>
        <div className="flex items-center gap-2">
          {USE_MOCKS && <LiveIndicator />}
          <LanguageSwitch />
        </div>
      </div>
      {USE_MOCKS && (
        <p className="bg-amber-soft px-4 py-1 text-center text-xs font-semibold text-ink">
          {t("app.demoData")}
        </p>
      )}
    </header>
  );
}
