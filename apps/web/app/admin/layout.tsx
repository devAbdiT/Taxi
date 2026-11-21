import { RequireRole } from "@/components/RequireRole";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <RequireRole role="ADMIN">{children}</RequireRole>;
}
