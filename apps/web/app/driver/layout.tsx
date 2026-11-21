import { RequireRole } from "@/components/RequireRole";
import { RoleBar } from "@/components/RoleBar";

export default function DriverLayout({ children }: LayoutProps<"/driver">) {
  return (
    <RequireRole role="DRIVER">
      <RoleBar />
      {children}
    </RequireRole>
  );
}
