"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useT } from "@/lib/i18n";
import type { ControllerActionView } from "@/lib/types";

interface AuditLogTabProps {
  data: ControllerActionView[];
}

export function AuditLogTab({ data }: AuditLogTabProps) {
  const t = useT();
  const [filter, setFilter] = useState("");

  const entries = data ?? [];
  const filtered = entries.filter((e) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      e.action.toLowerCase().includes(q) ||
      e.actorFirstName.toLowerCase().includes(q) ||
      (e.targetFirstName?.toLowerCase().includes(q) ?? false) ||
      e.reason.toLowerCase().includes(q)
    );
  });

  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div>
          <h2 className="font-display text-lg font-bold text-ink">
            {t("station.auditLog.title", "Audit Log (Append-Only)")}
          </h2>
          <p className="text-xs text-muted">
            {t("station.auditLog.immutable", "Every queue controller action is permanently recorded. Immutable record.")}
          </p>
        </div>

        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t("station.auditLog.search", "Filter log...")}
          className="rounded-xl border border-line bg-background px-3 py-1.5 text-xs text-ink focus:border-taxi focus:outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted">
          {t("station.auditLog.empty", "No actions logged yet.")}
        </div>
      ) : (
        <div className="mt-4 divide-y divide-line">
          {filtered.map((item) => (
            <div key={item.id} className="py-3 px-2 hover:bg-sky/20 rounded-xl transition">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-ink/10 px-2.5 py-0.5 text-xs font-bold text-ink">
                    {item.action.replace(/_/g, " ")}
                  </span>
                  <span className="text-xs font-medium text-ink">
                    <strong className="text-muted">{item.actorFirstName}</strong>
                    {item.targetFirstName ? (
                      <> → <strong className="text-ink">{item.targetFirstName}</strong></>
                    ) : null}
                  </span>
                </div>

                <span className="text-xs text-muted">
                  {new Date(item.createdAt).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              <p className="mt-1.5 text-xs text-muted leading-relaxed italic bg-sky/30 rounded-lg p-2">
                &ldquo;{item.reason}&rdquo;
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
