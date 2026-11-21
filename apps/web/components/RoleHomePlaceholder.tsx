"use client";

import { Button } from "@/components/Button";
import { useUser } from "@/components/RequireRole";
import { logout } from "@/lib/auth";
import { useT } from "@/lib/i18n";

/** Stand-in for role home screens that later phases replace. */
export function RoleHomePlaceholder() {
  const t = useT();
  const user = useUser();
  return (
    <section className="flex flex-col gap-4">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">{t(`role.${user.role}`)}</p>
      <h1 className="text-2xl font-bold">{t("home.welcome", { name: user.name })}</h1>
      <p className="text-slate-700">{t("home.comingSoon")}</p>
      <Button variant="secondary" onClick={logout} fullWidth>
        {t("nav.logout")}
      </Button>
    </section>
  );
}
