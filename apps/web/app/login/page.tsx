"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { FormError } from "@/components/States";
import { api } from "@/lib/api";
import { cleanPhone, homeFor, isValidPhone, startSession } from "@/lib/auth";
import { useT, type TKey } from "@/lib/i18n";

export default function LoginPage() {
  const t = useT();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ phone?: TKey; password?: TKey }>({});
  const [formError, setFormError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errors: typeof fieldErrors = {};
    if (!isValidPhone(phone)) errors.phone = "auth.invalidPhone";
    if (!password) errors.password = "auth.passwordRequired";
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length) return;

    await signIn(cleanPhone(phone), password);
  }

  async function signIn(nextPhone: string, nextPassword: string) {
    setSubmitting(true);
    try {
      const auth = await api.login({ phone: nextPhone, password: nextPassword });
      await startSession(auth);
      router.replace(homeFor(auth.user.role));
    } catch (err) {
      setFormError(err);
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-[24px] bg-card p-5 shadow-card sm:p-7">
      <h1 className="font-display text-3xl font-bold">{t("auth.loginTitle")}</h1>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
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
          error={fieldErrors.password && t(fieldErrors.password)}
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          type="button"
          className="min-h-12 self-start text-sm font-semibold text-cobalt underline"
          onClick={() => setShowPassword((value) => !value)}
        >
          {showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
        </button>

        <FormError error={formError} />

        <Button type="submit" loading={submitting} fullWidth>
          {t("auth.submitLogin")}
        </Button>
      </form>

      <p className="text-center">
        {t("auth.noAccount")}{" "}
        <Link href="/register" className="inline-block py-3 font-semibold text-cobalt underline">
          {t("home.register")}
        </Link>
      </p>
    </section>
  );
}
