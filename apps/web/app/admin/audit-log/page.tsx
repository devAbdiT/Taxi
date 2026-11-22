"use client";

import useSWR from "swr";
import { AuditLogTab } from "@/components/ControlDesk/AuditLogTab";
import { LoadingState } from "@/components/States";
import { api } from "@/lib/api";
import type { ControllerActionView } from "@/lib/types";

export default function AdminAuditLogPage() {
  const { data: log, error, isLoading } = useSWR<ControllerActionView[]>(
    "/admin/audit-log",
    () => api.adminAuditLog(),
    { refreshInterval: 10000 }
  );

  if (isLoading || !log) return <LoadingState />;

  return (
    <div className="flex flex-col gap-6 p-4 max-w-5xl mx-auto w-full">
      <header className="border-b border-line pb-4">
        <h1 className="font-display text-2xl font-bold text-ink">
          Global Controller Audit Trail
        </h1>
        <p className="text-xs text-muted">
          All station rep actions across Jimma routes. Read-only, append-only security log.
        </p>
      </header>

      <AuditLogTab data={log} />
    </div>
  );
}
