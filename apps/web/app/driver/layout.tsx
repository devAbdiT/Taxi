import { PhoneFrame } from "@/components/Frames";
import { RequireRole } from "@/components/RequireRole";

export default function DriverLayout({ children }: LayoutProps<"/driver">) {
  return (
    <RequireRole role="DRIVER">
      <PhoneFrame role="driver">{children}</PhoneFrame>
    </RequireRole>
  );
}
