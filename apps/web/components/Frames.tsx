"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { Logo } from "@/components/Logo";
import { LiveIndicator } from "@/components/kit";
import { useUser } from "@/components/RequireRole";
import { logout } from "@/lib/auth";
import { USE_MOCKS } from "@/lib/config";
import { useT, type TKey } from "@/lib/i18n";

type ShellRole = "passenger" | "driver" | "station" | "admin";

const links: Record<ShellRole, { href: string; label: TKey; icon: IconName; match: (path: string) => boolean }[]> = {
  passenger: [
    { href: "/passenger", label: "nav.routes", icon: "flag", match: (path) => path === "/passenger" },
    { href: "/passenger/queue", label: "nav.myQueue", icon: "clock", match: (path) => path.startsWith("/passenger/queue") },
    { href: "/passenger/trips", label: "nav.trips", icon: "arrowRight", match: (path) => path.startsWith("/passenger/trips") },
    { href: "/passenger/report", label: "nav.report", icon: "alert", match: (path) => path.startsWith("/passenger/report") },
    { href: "/contracts", label: "nav.contracts", icon: "inbox", match: (path) => path.startsWith("/contracts") },
    { href: "/passenger/profile", label: "nav.profile", icon: "users", match: (path) => path.startsWith("/passenger/profile") },
  ],
  driver: [
    { href: "/driver", label: "nav.demand", icon: "flag", match: (path) => path === "/driver" },
    { href: "/driver/reports", label: "nav.reports", icon: "alert", match: (path) => path.startsWith("/driver/reports") },
  ],
  station: [
    { href: "/station", label: "nav.queues", icon: "users", match: (path) => path.startsWith("/station") },
  ],
  admin: [
    { href: "/admin", label: "nav.overview", icon: "star", match: (path) => path.startsWith("/admin") },
  ],
};

export function AppShell({ role, children }: { role: ShellRole; children: ReactNode }) {
  const t = useT();
  const user = useUser();
  const path = usePathname();
  const items = links[role];

  return (
    <div className="min-h-dvh bg-cream lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="hero flex flex-col gap-6 px-4 py-4 lg:sticky lg:top-0 lg:h-dvh lg:justify-between lg:p-6">
        <div className="flex flex-col gap-6">
          <Link href="/" aria-label="MengedLink" className="inline-flex w-fit rounded-xl bg-white px-2 py-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-taxi">
            <Logo className="h-12 w-auto" />
          </Link>
          <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible" aria-label={t(`role.${user.role}`)}>
            {items.map((item) => {
              const active = item.match(path);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-12 shrink-0 items-center gap-2 rounded-[14px] px-4 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-taxi lg:w-full ${
                    active ? "bg-white text-cobalt" : "text-white hover:bg-white/15"
                  }`}
                >
                  <Icon name={item.icon} className="size-4" />
                  {t(item.label)}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="hidden lg:block">
          <p className="font-display text-xl font-bold">{user.name}</p>
          <p className="mt-1 text-sm text-white/80">{t(`role.${user.role}`)}</p>
          <button
            type="button"
            onClick={logout}
            className="mt-4 min-h-12 w-full rounded-[14px] bg-white/15 px-4 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-taxi"
          >
            {t("nav.logout")}
          </button>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-card/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
          <div className="min-w-0 lg:hidden">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t(`role.${user.role}`)}</p>
            <p className="truncate font-display text-lg font-bold">{user.name}</p>
          </div>
          <p className="hidden text-sm font-semibold text-muted lg:block">{t(`role.${user.role}`)}</p>
          <div className="flex items-center gap-2">
            {USE_MOCKS && <LiveIndicator />}
            <LanguageSwitch />
            <button
              type="button"
              onClick={logout}
              className="min-h-12 rounded-[14px] border border-line px-3 text-sm font-semibold lg:hidden"
            >
              {t("nav.logout")}
            </button>
          </div>
        </header>
        <main id="content" className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function PhoneFrame({ role, children }: { role: "passenger" | "driver"; children: ReactNode }) {
  return <AppShell role={role}>{children}</AppShell>;
}

export function DeskFrame({ children }: { children: ReactNode }) {
  const path = usePathname();
  const role = path.startsWith("/admin") ? "admin" : "station";
  return <AppShell role={role}>{children}</AppShell>;
}
