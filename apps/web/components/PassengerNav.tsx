"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT, type TKey } from "@/lib/i18n";

const links: { href: string; label: TKey }[] = [
  { href: "/passenger", label: "nav.routes" },
  { href: "/passenger/queue", label: "nav.myQueue" },
  { href: "/passenger/profile", label: "nav.profile" },
];

  const item =
  "flex min-h-12 items-center justify-center rounded-[14px] px-2 text-center text-sm font-semibold " +
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-taxi";

export function PassengerNav() {
  const t = useT();
  const pathname = usePathname();
  return (
    <nav className="mb-6 grid grid-cols-3 gap-1 rounded-[20px] border border-line bg-card p-1 shadow-card">
      {links.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`${item} ${active ? "bg-cobalt text-white" : "text-ink hover:bg-sky"}`}
          >
            {t(label)}
          </Link>
        );
      })}
    </nav>
  );
}
