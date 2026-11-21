"use client";

import { ButtonLink } from "@/components/Button";
import { useT } from "@/lib/i18n";

export default function HomePage() {
  const t = useT();
  return (
    <section className="flex flex-col gap-8 pt-6">
      <p className="text-2xl font-semibold leading-snug">{t("home.pitch")}</p>
      <div className="flex flex-col gap-3">
        <ButtonLink href="/login" fullWidth>
          {t("home.login")}
        </ButtonLink>
        <ButtonLink href="/register" variant="secondary" fullWidth>
          {t("home.register")}
        </ButtonLink>
      </div>
    </section>
  );
}
