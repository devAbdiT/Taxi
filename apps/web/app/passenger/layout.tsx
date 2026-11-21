import { PhoneFrame } from "@/components/Frames";
import { RequireRole } from "@/components/RequireRole";

export default function PassengerLayout({ children }: LayoutProps<"/passenger">) {
  return (
    <RequireRole role="PASSENGER">
      <PhoneFrame role="passenger">{children}</PhoneFrame>
    </RequireRole>
  );
}
