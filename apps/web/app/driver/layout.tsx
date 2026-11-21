import { RequireRole } from "@/components/RequireRole";

export default function DriverLayout({ children }: LayoutProps<"/driver">) {
  return <RequireRole role="DRIVER">{children}</RequireRole>;
}
