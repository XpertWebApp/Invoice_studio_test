import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { focusRing } from "./Field";
import { SpinnerIcon } from "./icons";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  ref?: Ref<HTMLButtonElement>;
  variant?: Variant;
  size?: "sm" | "md";
  icon?: ReactNode;
  /** Shows a spinner and ignores clicks (stays focusable, aria-busy). */
  loading?: boolean;
  /**
   * Looks disabled and is announced as disabled, but stays focusable and
   * clickable so the parent can explain why (it should ignore the action).
   */
  softDisabled?: boolean;
}

const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-strong border border-transparent",
  secondary: "bg-white text-accent border border-accent hover:bg-accent-soft",
  ghost: "bg-transparent text-stone-800 border border-stone-300 hover:bg-stone-100",
  danger: "bg-transparent text-red-700 border border-transparent hover:bg-red-50",
};

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  loading = false,
  softDisabled = false,
  className = "",
  children,
  onClick,
  ...props
}: ButtonProps) {
  const sizing = size === "sm" ? "min-h-9 px-3 text-sm" : "min-h-10 px-4 text-sm";
  return (
    <button
      type="button"
      {...props}
      onClick={(e) => {
        if (loading) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      aria-disabled={softDisabled || loading || undefined}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 ${focusRing} ${sizing} ${variants[variant]} ${className}`}
    >
      {loading ? <SpinnerIcon /> : icon}
      {children}
    </button>
  );
}
