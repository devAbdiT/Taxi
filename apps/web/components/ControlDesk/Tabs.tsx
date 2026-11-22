"use client";

import { useT } from "@/lib/i18n";
import { Icon, type IconName } from "@/components/Icon";

interface TabsProps {
  active: string;
  onChange: (tab: string) => void;
  counts?: {
    queue?: number;
    driverLine?: number;
    disputes?: number;
    alerts?: number;
  };
}

interface TabDef {
  id: string;
  labelKey: string;
  defaultLabel: string;
  icon: IconName;
  badge?: number;
}

export function ControlDeskTabs({ active, onChange, counts }: TabsProps) {
  const t = useT();

  const tabs: TabDef[] = [
    { id: "queue", labelKey: "station.tab.queue", defaultLabel: "Passenger Queue", icon: "users", badge: counts?.queue },
    { id: "driverLine", labelKey: "station.tab.driverLine", defaultLabel: "Driver Line", icon: "car", badge: counts?.driverLine },
    { id: "disputes", labelKey: "station.tab.disputes", defaultLabel: "Disputes", icon: "alert", badge: counts?.disputes },
    { id: "alerts", labelKey: "station.tab.alerts", defaultLabel: "Alerts", icon: "bell", badge: counts?.alerts },
    { id: "auditLog", labelKey: "station.tab.auditLog", defaultLabel: "Audit Log", icon: "clock" },
    { id: "fleet", labelKey: "station.tab.fleet", defaultLabel: "Fleet Map", icon: "mapPin" },
  ];

  return (
    <div className="flex border-b border-line overflow-x-auto gap-2 pb-px" role="tablist">
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`inline-flex min-h-12 items-center gap-2 px-4 py-2 font-medium text-sm rounded-t-lg transition whitespace-nowrap border-b-2 ${
              isActive
                ? "border-taxi bg-taxi/10 text-ink font-bold"
                : "border-transparent text-muted hover:text-ink hover:bg-black/5"
            }`}
          >
            <Icon name={tab.icon} className="size-4" />
            <span>{t(tab.labelKey, tab.defaultLabel)}</span>
            {typeof tab.badge === "number" && tab.badge > 0 && (
              <span
                className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                  tab.id === "disputes" || tab.id === "alerts"
                    ? "bg-red-500 text-white"
                    : "bg-ink/10 text-ink"
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
