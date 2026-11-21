"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { Icon } from "@/components/Icon";
import { FormError } from "@/components/States";
import { api } from "@/lib/api";
import { cleanPhone, homeFor, isValidPhone, startSession } from "@/lib/auth";
import { setLanguage, useLanguage, useT, type TKey } from "@/lib/i18n";
import type { Language } from "@/lib/types";

const MIN_PASSWORD = 6;
const languages: Language[] = ["en", "am"];

type FieldName = "name" | "phone" | "password";

export default function RegisterPage() {
  const t = useT();
  const router = useRouter();
  const uiLanguage = useLanguage();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [chosenLanguage, setChosenLanguage] = useState<Language | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, TKey>>>({});
  const [formError, setFormError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  const language = chosenLanguage ?? uiLanguage;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errors: typeof fieldErrors = {};
    if (!name.trim()) errors.name = "auth.nameRequired";
    if (!isValidPhone(phone)) errors.phone = "auth.invalidPhone";
    if (password.length < MIN_PASSWORD) errors.password = "auth.passwordTooShort";
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length) return;

    setSubmitting(true);
    try {
      const auth = await api.register({ name: name.trim(), phone: cleanPhone(phone), password, language });
      await startSession(auth);
      setLanguage(language);
      router.replace(homeFor(auth.user.role));
    } catch (err) {
      setFormError(err);
      setSubmitting(false);
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("auth.registerTitle")}</h1>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <Field
          label={t("auth.name")}
          error={fieldErrors.name && t(fieldErrors.name)}
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Field
          label={t("auth.phone")}
          hint={t("auth.phoneHint")}
          error={fieldErrors.phone && t(fieldErrors.phone)}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="09…"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Field
          label={t("auth.password")}
          hint={t("auth.passwordHint")}
          error={fieldErrors.password && t(fieldErrors.password)}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-base font-semibold">{t("auth.language")}</legend>
          <div className="grid grid-cols-2 gap-2">
            {languages.map((lang) => (
              <label
                key={lang}
                lang={lang}
                className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 px-3 text-lg font-semibold has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-amber-400 ${
                  language === lang ? "border-slate-800 bg-slate-800 text-white" : "border-slate-400 bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="language"
                  value={lang}
                  checked={language === lang}
                  onChange={() => setChosenLanguage(lang)}
                  className="sr-only"
                />
                {language === lang && <Icon name="check" />}
                {t(`lang.${lang}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <FormError error={formError} />

        <Button type="submit" loading={submitting} fullWidth>
          {t("auth.submitRegister")}
        </Button>
      </form>

      <p className="text-center">
        {t("auth.haveAccount")}{" "}
        <Link href="/login" className="inline-block py-3 font-semibold text-emerald-800 underline">
          {t("home.login")}
        </Link>
      </p>
    </section>
  );
}
