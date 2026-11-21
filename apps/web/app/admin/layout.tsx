import { DeskFrame } from "@/components/Frames";
import { RequireRole } from "@/components/RequireRole";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <RequireRole role="ADMIN">
      <DeskFrame>{children}</DeskFrame>
    </RequireRole>
  );
}
