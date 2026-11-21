"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/Button";
import { enterAs, homeFor } from "@/lib/auth";
import { useLanguage, useT } from "@/lib/i18n";

export default function LoginPage() {
  const t = useT();
  const lang = useLanguage();
  const router = useRouter();
  const [opening, setOpening] = useState<"PASSENGER" | "DRIVER" | null>(null);

  async function open(role: "PASSENGER" | "DRIVER") {
    setOpening(role);
    await enterAs(role, lang);
    router.replace(homeFor(role));
  }

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("auth.loginTitle")}</h1>
      <p className="text-lg text-slate-700">{t("auth.pickRole")}</p>
      <Button onClick={() => open("PASSENGER")} loading={opening === "PASSENGER"} disabled={!!opening} fullWidth>
        {t("auth.asPassenger")}
      </Button>
      <Button variant="secondary" onClick={() => open("DRIVER")} loading={opening === "DRIVER"} disabled={!!opening} fullWidth>
        {t("auth.asDriver")}
      </Button>
    </section>
  );
}
