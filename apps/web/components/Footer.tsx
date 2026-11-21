"use client";

import Link from "next/link";
import { Logo } from "@/components/Logo";
import { useT } from "@/lib/i18n";

export function Footer() {
  const t = useT();
  return (
    <footer className="mt-auto border-t border-line bg-card">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:px-6">
        <Logo className="h-14 w-auto" />
        <p className="max-w-md text-base">{t("home.footerBlurb")}</p>
        <nav aria-label={t("app.name")} className="flex flex-wrap gap-x-5 gap-y-2 text-base font-semibold">
          <Link href="/login" className="min-h-11 inline-flex items-center underline decoration-line underline-offset-4 hover:decoration-cobalt">
            {t("home.login")}
          </Link>
          <Link href="/register" className="min-h-11 inline-flex items-center underline decoration-line underline-offset-4 hover:decoration-cobalt">
            {t("home.register")}
          </Link>
          <Link href="/#how" className="min-h-11 inline-flex items-center underline decoration-line underline-offset-4 hover:decoration-cobalt">
            {t("home.ctaHow")}
          </Link>
        </nav>
        <p className="text-sm text-muted">{t("home.footer")}</p>
      </div>
    </footer>
  );
}
