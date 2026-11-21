import { PassengerNav } from "@/components/PassengerNav";
import { RequireRole } from "@/components/RequireRole";

export default function PassengerLayout({ children }: LayoutProps<"/passenger">) {
  return (
    <RequireRole role="PASSENGER">
      <PassengerNav />
      {children}
    </RequireRole>
  );
}
