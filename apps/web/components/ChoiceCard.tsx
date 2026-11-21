import type { ReactNode } from "react";
import { Icon } from "@/components/Icon";

interface ChoiceCardProps {
  name: string;
  value: string;
  checked: boolean;
  onSelect: () => void;
  children: ReactNode;
  className?: string;
}

/** A large radio option: the whole card is the tap target, and the chosen one shows a tick. */
export function ChoiceCard({ name, value, checked, onSelect, children, className = "" }: ChoiceCardProps) {
  return (
    <label
      className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-[20px] border px-4 py-3 shadow-card has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-taxi ${
        checked ? "border-cobalt bg-cobalt text-white" : "border-line bg-card hover:border-cobalt"
      } ${className}`}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onSelect} className="sr-only" />
      <span
        aria-hidden="true"
        className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${
          checked ? "border-white bg-taxi text-ink" : "border-line"
        }`}
      >
        {checked && <Icon name="check" className="size-4" />}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}
