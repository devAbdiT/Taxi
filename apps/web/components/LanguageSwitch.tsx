"use client";

import { setLanguage, useLanguage, useT } from "@/lib/i18n";
import type { Language } from "@/lib/types";

const options: Language[] = ["en", "am"];

export function LanguageSwitch() {
  const t = useT();
  const current = useLanguage();
  return (
    <div role="group" aria-label={t("lang.label")} className="flex rounded-xl border-2 border-slate-800 p-0.5">
      {options.map((lang) => (
        <button
          key={lang}
          type="button"
          lang={lang}
          aria-pressed={current === lang}
          onClick={() => setLanguage(lang)}
          className={`min-h-12 rounded-lg px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400 ${
            current === lang ? "bg-slate-800 text-white" : "text-slate-900 hover:bg-slate-100"
          }`}
        >
          {t(`lang.${lang}`)}
        </button>
      ))}
    </div>
  );
}
