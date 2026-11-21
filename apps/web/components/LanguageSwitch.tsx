"use client";

import { setLanguage, useLanguage, useT } from "@/lib/i18n";
import type { Language } from "@/lib/types";

const options: Language[] = ["en", "am"];

export function LanguageSwitch() {
  const t = useT();
  const current = useLanguage();
  return (
    <div role="group" aria-label={t("lang.label")} className="flex rounded-full border border-line bg-cream p-0.5">
      {options.map((lang) => (
        <button
          key={lang}
          type="button"
          lang={lang}
          aria-pressed={current === lang}
          onClick={() => setLanguage(lang)}
          className={`min-h-12 rounded-full px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-taxi ${
            current === lang ? "bg-cobalt text-white" : "text-ink hover:bg-sky"
          }`}
        >
          {t(`lang.${lang}`)}
        </button>
      ))}
    </div>
  );
}
