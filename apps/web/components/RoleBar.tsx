"use client";

import { useUser } from "@/components/RequireRole";
import { logout } from "@/lib/auth";
import { useT } from "@/lib/i18n";

/** Who is signed in, plus Log out. Used on the staff screens (driver, station rep, admin). */
export function RoleBar() {
  const t = useT();
  const user = useUser();
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">{t(`role.${user.role}`)}</p>
        <p className="truncate font-semibold">{user.name}</p>
      </div>
      <button
        type="button"
        onClick={logout}
        className="min-h-12 shrink-0 rounded-xl border-2 border-slate-800 bg-white px-4 text-sm font-semibold hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400"
      >
        {t("nav.logout")}
      </button>
    </div>
  );
}
