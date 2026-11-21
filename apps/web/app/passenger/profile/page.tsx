"use client";

import Link from "next/link";
import { Button } from "@/components/Button";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { useUser } from "@/components/RequireRole";
import { logout } from "@/lib/auth";
import { useT, type TKey } from "@/lib/i18n";

const links: { href: string; key: TKey }[] = [
  { href: "/passenger/trips", key: "nav.trips" },
  { href: "/passenger/report", key: "nav.report" },
  { href: "/contracts", key: "nav.contracts" },
  { href: "/dev/sms", key: "nav.sms" },
];

export default function ProfilePage() {
  const t = useT();
  const user = useUser();
  return (
    <section className="grid items-start gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <article className="flex flex-col gap-4 rounded-[20px] border border-line bg-card p-6 shadow-card">
        <h1 className="font-display text-3xl font-bold">{user.name}</h1>
        <p className="text-muted">{t(`role.${user.role}`)}</p>
        <p className="text-sm text-muted">{user.phone}</p>
        <LanguageSwitch />
        <Button variant="secondary" onClick={logout}>{t("nav.logout")}</Button>
      </article>
      <article className="rounded-[20px] border border-line bg-card p-6 shadow-card">
        <h2 className="font-display text-xl font-bold">{t("nav.profile")}</h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {links.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="flex min-h-12 items-center rounded-[14px] bg-cream px-4 font-semibold hover:bg-sky">
                {t(link.key)}
              </Link>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
