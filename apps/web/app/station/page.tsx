"use client";

import { useState } from "react";
import useSWR from "swr";
import { useToast } from "@/components/Providers";
import { LoadingState } from "@/components/States";
import { ControlDeskHeader } from "@/components/ControlDesk/Header";
import { ControlDeskTabs } from "@/components/ControlDesk/Tabs";
import { QueueTab } from "@/components/ControlDesk/QueueTab";
import { DriverLineTab } from "@/components/ControlDesk/DriverLineTab";
import { DisputesTab } from "@/components/ControlDesk/DisputesTab";
import { AlertsTab } from "@/components/ControlDesk/AlertsTab";
import { AuditLogTab } from "@/components/ControlDesk/AuditLogTab";
import { FleetMap } from "@/components/FleetMap";
import { api, fetcher } from "@/lib/api";
import { REFRESH_MS } from "@/lib/config";
import { useT } from "@/lib/i18n";
import type { StationDeskResponse, FairnessAlert, Dispute, ControllerActionView } from "@/lib/types";

export default function StationPage() {
  const t = useT();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<string>("queue");

  // Main desk data (queues, counts, driver line)
  const { data: deskData, error: deskError, mutate: mutateDesk } = useSWR<StationDeskResponse>(
    "/station/desk",
    () => api.stationDesk(),
    { refreshInterval: REFRESH_MS }
  );

  // Independent feeds
  const { data: alerts } = useSWR<FairnessAlert[]>(
    "/station/alerts",
    () => api.stationAlerts(),
    { refreshInterval: REFRESH_MS }
  );

  const { data: disputes, mutate: mutateDisputes } = useSWR<Dispute[]>(
    "/station/disputes",
    () => api.stationDisputes(),
    { refreshInterval: REFRESH_MS }
  );

  const { data: auditLog } = useSWR<ControllerActionView[]>(
    "/station/audit-log",
    () => api.auditLog(),
    { refreshInterval: 10000 }
  );

  if (deskError) return <div className="p-4 text-alert">{t("common.error", "Could not load station desk")}</div>;
  if (!deskData) return <LoadingState />;

  const counts = {
    waiting: deskData.counts?.waiting ?? 0,
    priority: deskData.counts?.priority ?? 0,
    disputes: deskData.counts?.openDisputes ?? disputes?.length ?? 0,
    alerts: deskData.counts?.alerts ?? alerts?.length ?? 0,
  };

  const tabCounts = {
    queue: counts.waiting,
    driverLine: deskData.driverLine?.length ?? 0,
    disputes: counts.disputes,
    alerts: counts.alerts,
  };

  return (
    <div className="flex flex-col gap-5 p-4 max-w-7xl mx-auto w-full">
      <ControlDeskHeader
        stationName={deskData.station.name}
        live={true}
        counts={counts}
      />

      <ControlDeskTabs
        active={activeTab}
        onChange={setActiveTab}
        counts={tabCounts}
      />

      <div className="flex-1 mt-2">
        {activeTab === "queue" && (
          <QueueTab data={deskData} onActionSuccess={() => mutateDesk()} />
        )}
        {activeTab === "driverLine" && (
          <DriverLineTab data={deskData.driverLine} onActionSuccess={() => mutateDesk()} />
        )}
        {activeTab === "disputes" && (
          <DisputesTab
            data={disputes ?? []}
            onActionSuccess={() => {
              mutateDisputes();
              mutateDesk();
            }}
          />
        )}
        {activeTab === "alerts" && (
          <AlertsTab
            data={alerts ?? []}
            onTakeAction={() => setActiveTab("queue")}
          />
        )}
        {activeTab === "auditLog" && (
          <AuditLogTab data={auditLog ?? []} />
        )}
        {activeTab === "fleet" && (
          <div className="rounded-2xl border border-line bg-card p-5 shadow-xs">
            <FleetMap className="h-[500px] w-full rounded-xl overflow-hidden" />
          </div>
        )}
      </div>
    </div>
  );
}
