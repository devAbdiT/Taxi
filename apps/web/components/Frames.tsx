"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { Logo } from "@/components/Logo";
import { LiveIndicator } from "@/components/kit";
import { useUser } from "@/components/RequireRole";
import { logout } from "@/lib/auth";
import { USE_MOCKS } from "@/lib/config";
import { useT, type TKey } from "@/lib/i18n";

function TabBar({ links }: { links: { href: string; label: TKey; match: (path: string) => boolean }[] }) {
  const t = useT();
  const path = usePathname();
  return (
    <nav
      className="grid shrink-0 gap-1 border-t border-line bg-card px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1"
      style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }}
    >
      {links.map((link) => {
        const active = link.match(path);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-12 items-center justify-center rounded-[14px] px-1 text-center text-xs font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-taxi sm:text-sm ${
              active ? "bg-cobalt text-white" : "text-ink hover:bg-sky"
            }`}
          >
            {t(link.label)}
          </Link>
        );
      })}
    </nav>
  );
}

const passengerLinks = [
  { href: "/passenger", label: "nav.routes" as const, match: (path: string) => path === "/passenger" },
  { href: "/passenger/queue", label: "nav.myQueue" as const, match: (path: string) => path.startsWith("/passenger/queue") },
  { href: "/passenger/trips", label: "nav.trips" as const, match: (path: string) => path.startsWith("/passenger/trips") },
  { href: "/passenger/profile", label: "nav.profile" as const, match: (path: string) => path.startsWith("/passenger/profile") || path.startsWith("/passenger/report") },
];

const driverLinks = [
  { href: "/driver", label: "nav.demand" as const, match: (path: string) => path === "/driver" },
  { href: "/driver/reports", label: "nav.reports" as const, match: (path: string) => path.startsWith("/driver/reports") },
];

export function PhoneFrame({ role, children }: { role: "passenger" | "driver"; children: ReactNode }) {
  const t = useT();
  const user = useUser();
  const links = role === "passenger" ? passengerLinks : driverLinks;
  return (
    <div className="stage min-h-dvh md:grid md:min-h-dvh md:place-items-center md:p-6">
      <div className="mx-auto flex h-dvh w-full max-w-[480px] flex-col overflow-hidden bg-cream md:h-[min(920px,calc(100dvh-3rem))] md:rounded-[32px] md:shadow-card md:ring-8 md:ring-white/50">
        <header className="hero flex shrink-0 items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Link href="/" aria-label="MengedLink" className="shrink-0 rounded-xl bg-white px-1.5 py-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-taxi">
              <Logo className="h-9 w-auto" />
            </Link>
            <p className="truncate font-display text-lg font-bold">{user.name.split(" ")[0]}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden sm:inline-flex">{USE_MOCKS && <LiveIndicator />}</span>
            <LanguageSwitch />
            {role === "driver" && (
              <button
                type="button"
                onClick={logout}
                className="min-h-12 rounded-full bg-white/15 px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-taxi"
              >
                {t("nav.logout")}
              </button>
            )}
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        <TabBar links={links} />
      </div>
    </div>
  );
}

export function DeskFrame({ children }: { children: ReactNode }) {
  const t = useT();
  const user = useUser();
  return (
    <div className="min-h-dvh bg-cream lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="hero hidden lg:flex lg:min-h-dvh lg:flex-col lg:justify-between lg:p-6">
        <div>
          <Link href="/" aria-label="MengedLink" className="inline-flex rounded-2xl bg-white px-2 py-1.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-taxi">
            <Logo className="h-16 w-auto" />
          </Link>
          <p className="mt-6 font-display text-2xl font-bold">{user.name.split(" ")[0]}</p>
          <p className="mt-1 text-sm text-white/80">{t(`role.${user.role}`)}</p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="min-h-12 rounded-[14px] bg-white/15 px-4 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-taxi"
        >
          {t("nav.logout")}
        </button>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-card/95 px-4 py-2 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Logo className="h-11 w-auto lg:hidden" />
            <div className="min-w-0 lg:hidden">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{t(`role.${user.role}`)}</p>
              <p className="truncate font-display text-lg font-bold">{user.name.split(" ")[0]}</p>
            </div>
          </div>
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
        <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 lg:px-8">{children}</div>
      </div>
    </div>
  );
}
