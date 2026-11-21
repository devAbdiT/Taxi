import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon } from "@/components/Icon";

type Variant = "primary" | "secondary" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-emerald-700 text-white hover:bg-emerald-800 active:bg-emerald-900",
  secondary: "border-2 border-slate-800 bg-white text-slate-900 hover:bg-slate-100 active:bg-slate-200",
  danger: "bg-red-700 text-white hover:bg-red-800 active:bg-red-900",
};

const base =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-semibold " +
  "transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

interface CommonProps {
  variant?: Variant;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}

function classes({ variant = "primary", fullWidth, className = "" }: CommonProps) {
  return `${base} ${variants[variant]} ${fullWidth ? "w-full" : ""} ${className}`;
}

export function Button({
  variant,
  fullWidth,
  className,
  loading = false,
  disabled,
  children,
  type = "button",
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classes({ variant, fullWidth, className, children })}
      {...rest}
    >
      {loading && <Icon name="spinner" className="size-5 animate-spin" />}
      {children}
    </button>
  );
}

export function ButtonLink({ href, ...props }: CommonProps & { href: string }) {
  return (
    <Link href={href} className={classes(props)}>
      {props.children}
    </Link>
  );
}
