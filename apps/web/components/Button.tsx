import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon } from "@/components/Icon";

type Variant = "primary" | "secondary" | "danger" | "accent";

const variants: Record<Variant, string> = {
  primary: "bg-cobalt text-white hover:bg-cobalt-deep active:scale-[.98]",
  secondary: "border-2 border-line bg-card text-ink hover:bg-sky active:scale-[.98]",
  danger: "bg-alert text-white hover:bg-alert/90 active:scale-[.98]",
  accent: "bg-taxi text-ink hover:brightness-95 active:scale-[.98]",
};

const base =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-[14px] px-5 py-3 text-base font-semibold " +
  "transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-taxi " +
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
