"use client";

import { useCallback, useSyncExternalStore } from "react";
import en from "@/i18n/en.json";
import am from "@/i18n/am.json";
import type { Language } from "@/lib/types";

export type TKey = keyof typeof en;
export type TVars = Record<string, string | number>;

const dictionaries: Record<Language, Partial<Record<string, string>>> = { en, am };
const STORAGE_KEY = "taxiflow.lang";
const listeners = new Set<() => void>();

function readLanguage(): Language {
  return localStorage.getItem(STORAGE_KEY) === "am" ? "am" : "en";
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function setLanguage(lang: Language) {
  localStorage.setItem(STORAGE_KEY, lang);
  listeners.forEach((notify) => notify());
}

export function useLanguage(): Language {
  return useSyncExternalStore(subscribe, readLanguage, () => "en");
}

export function hasKey(key: string): key is TKey {
  return key in en;
}

export function translate(lang: Language, key: string, varsOrFallback?: TVars | string): string {
  const fallback = typeof varsOrFallback === "string" ? varsOrFallback : undefined;
  const vars = typeof varsOrFallback === "object" ? varsOrFallback : undefined;

  const dict = dictionaries[lang] as Record<string, string | undefined>;
  const enDict = dictionaries.en as Record<string, string | undefined>;
  const text = dict[key] ?? enDict[key] ?? fallback ?? key;

  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export function useT() {
  const lang = useLanguage();
  return useCallback((key: string, varsOrFallback?: TVars | string) => translate(lang, key, varsOrFallback), [lang]);
}
