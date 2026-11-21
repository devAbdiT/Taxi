import { RequireRole } from "@/components/RequireRole";

export default function PassengerLayout({ children }: LayoutProps<"/passenger">) {
  return <RequireRole role="PASSENGER">{children}</RequireRole>;
}
