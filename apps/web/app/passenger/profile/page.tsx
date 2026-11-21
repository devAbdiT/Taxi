"use client";

import Link from "next/link";
import { Button } from "@/components/Button";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { useUser } from "@/components/RequireRole";
import { logout } from "@/lib/auth";
import { useT } from "@/lib/i18n";

const links = [
  { href: "/passenger/trips", key: "nav.trips" },
  { href: "/passenger/report", key: "nav.report" },
  { href: "/dev/sms", key: "nav.sms" },
] as const;

export default function ProfilePage() {
  const t = useT();
  const user = useUser();
  return (
    <section className="flex flex-col gap-4">
      <h1 className="font-display text-3xl font-bold">{user.name}</h1>
      <p className="text-muted">{t(`role.${user.role}`)}</p>
      <LanguageSwitch />
      {links.map((link) => (
        <Link key={link.href} href={link.href} className="flex min-h-12 items-center rounded-[14px] bg-card px-4 font-semibold shadow-card">
          {t(link.key)}
        </Link>
      ))}
      <Button variant="secondary" onClick={logout} fullWidth>{t("nav.logout")}</Button>
    </section>
  );
}
