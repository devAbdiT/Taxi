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

export function translate(lang: Language, key: TKey, vars?: TVars): string {
  const text = dictionaries[lang][key] ?? dictionaries.en[key] ?? key;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export function useT() {
  const lang = useLanguage();
  return useCallback((key: TKey, vars?: TVars) => translate(lang, key, vars), [lang]);
}
