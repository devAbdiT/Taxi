"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n";

export function DriverNav() {
  const t = useT();
  const path = usePathname();
  const links = [
    { href: "/driver", label: t("nav.demand") },
    { href: "/driver/reports", label: t("nav.reports") },
  ];
  return (
    <nav className="mb-4 grid grid-cols-2 gap-1 rounded-[20px] bg-card p-1 shadow-card">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`flex min-h-12 items-center justify-center rounded-[14px] text-sm font-semibold ${path === link.href ? "bg-cobalt text-white" : ""}`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
