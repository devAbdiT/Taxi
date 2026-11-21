"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/auth";
import { useT, type TKey } from "@/lib/i18n";

const links: { href: string; label: TKey }[] = [
  { href: "/passenger", label: "nav.routes" },
  { href: "/passenger/queue", label: "nav.myQueue" },
  { href: "/passenger/trips", label: "nav.trips" },
  { href: "/passenger/report", label: "nav.report" },
  { href: "/contracts", label: "nav.contracts" },
];

const item =
  "flex min-h-12 items-center justify-center rounded-lg px-2 text-center text-sm font-semibold " +
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400";

export function PassengerNav() {
  const t = useT();
  const pathname = usePathname();
  return (
    <nav className="mb-6 flex flex-wrap gap-1 rounded-xl border-2 border-slate-200 bg-white p-1">
      {links.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`${item} ${active ? "bg-emerald-700 text-white" : "text-slate-900 hover:bg-slate-100"}`}
          >
            {t(label)}
          </Link>
        );
      })}
      <button type="button" onClick={logout} className={`${item} text-slate-900 hover:bg-slate-100`}>
        {t("nav.logout")}
      </button>
    </nav>
  );
}
