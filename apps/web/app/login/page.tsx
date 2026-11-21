"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { FormError } from "@/components/States";
import { api } from "@/lib/api";
import { cleanPhone, homeFor, isValidPhone, startSession } from "@/lib/auth";
import { USE_MOCKS } from "@/lib/config";
import { useT, type TKey } from "@/lib/i18n";
import type { Role } from "@/lib/types";

const demoAccounts: { role: Role; phone: string }[] = [
  { role: "PASSENGER", phone: "0911000100" },
  { role: "DRIVER", phone: "0911000001" },
  { role: "STATION_REP", phone: "0911000011" },
  { role: "ADMIN", phone: "0911000099" },
];

export default function LoginPage() {
  const t = useT();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
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

    setSubmitting(true);
    try {
      const auth = await api.login({ phone: cleanPhone(phone), password });
      await startSession(auth);
      router.replace(homeFor(auth.user.role));
    } catch (err) {
      setFormError(err);
      setSubmitting(false);
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("auth.loginTitle")}</h1>

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
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <FormError error={formError} />

        <Button type="submit" loading={submitting} fullWidth>
          {t("auth.submitLogin")}
        </Button>
      </form>

      <p className="text-center">
        {t("auth.noAccount")}{" "}
        <Link href="/register" className="inline-block py-3 font-semibold text-emerald-800 underline">
          {t("home.register")}
        </Link>
      </p>

      {USE_MOCKS && (
        <div className="flex flex-col gap-2 rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50 p-4">
          <p className="font-semibold text-amber-950">{t("auth.demoAccounts")}</p>
          <div className="grid grid-cols-2 gap-2">
            {demoAccounts.map((account) => (
              <Button
                key={account.role}
                variant="secondary"
                className="px-2 text-sm"
                onClick={() => {
                  setPhone(account.phone);
                  setPassword("demo1234");
                  setFieldErrors({});
                  setFormError(null);
                }}
              >
                {t(`role.${account.role}`)}
              </Button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
