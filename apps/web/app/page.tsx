"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/Button";
import { enterAs, homeFor } from "@/lib/auth";
import { useLanguage, useT } from "@/lib/i18n";

export default function HomePage() {
  const t = useT();
  const lang = useLanguage();
  const router = useRouter();
  const [opening, setOpening] = useState<"PASSENGER" | "DRIVER" | null>(null);

  async function open(role: "PASSENGER" | "DRIVER") {
    setOpening(role);
    await enterAs(role, lang);
    router.push(homeFor(role));
  }

  return (
    <section className="flex flex-col gap-8 pt-6">
      <p className="text-2xl font-semibold leading-snug">{t("home.pitch")}</p>
      <div className="flex flex-col gap-3">
        <Button onClick={() => open("PASSENGER")} loading={opening === "PASSENGER"} disabled={!!opening} fullWidth>
          {t("auth.asPassenger")}
        </Button>
        <Button variant="secondary" onClick={() => open("DRIVER")} loading={opening === "DRIVER"} disabled={!!opening} fullWidth>
          {t("auth.asDriver")}
        </Button>
      </div>
    </section>
  );
}
