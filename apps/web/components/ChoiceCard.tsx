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
      className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-amber-400 ${
        checked ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white hover:border-slate-500"
      } ${className}`}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onSelect} className="sr-only" />
      <span
        aria-hidden="true"
        className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${
          checked ? "border-white bg-white text-slate-900" : "border-slate-400"
        }`}
      >
        {checked && <Icon name="check" className="size-4" />}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}
