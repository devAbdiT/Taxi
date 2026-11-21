import { RequireRole } from "@/components/RequireRole";

export default function StationLayout({ children }: LayoutProps<"/station">) {
  return <RequireRole role="STATION_REP">{children}</RequireRole>;
}
