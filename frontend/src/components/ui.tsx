import * as React from "react";
import { cn } from "../lib/utils";

// -------------------------------------------------------------------- Button
type ButtonVariant = "default" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "default" | "sm" | "lg" | "icon";

const buttonVariants: Record<ButtonVariant, string> = {
  default:
    "bg-primary text-primary-foreground hover:bg-primary/90 shadow-soft",
  secondary:
    "bg-accent text-accent-foreground hover:bg-accent/70 border border-border/60",
  outline:
    "border border-border bg-card/60 text-foreground hover:bg-accent/60",
  ghost: "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
  danger: "bg-danger text-white hover:bg-danger/90",
};

const buttonSizes: Record<ButtonSize, string> = {
  default: "h-10 px-4 text-sm",
  sm: "h-8 px-3 text-xs",
  lg: "h-11 px-6 text-sm",
  icon: "h-9 w-9",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all",
        "disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";

// --------------------------------------------------------------------- Card
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass rounded-xl", className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 p-5 pb-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-sm font-semibold tracking-tight", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs text-muted-foreground", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-2", className)} {...props} />;
}

// -------------------------------------------------------------------- Badge
type BadgeVariant = "default" | "success" | "warning" | "danger" | "outline" | "info";

const badgeVariants: Record<BadgeVariant, string> = {
  default: "bg-accent text-accent-foreground border-transparent",
  success: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
  warning: "bg-amber-500/12 text-amber-700 dark:text-amber-400 border-amber-500/25",
  danger: "bg-rose-500/12 text-rose-700 dark:text-rose-400 border-rose-500/25",
  info: "bg-sky-500/12 text-sky-700 dark:text-sky-400 border-sky-500/25",
  outline: "border-border text-muted-foreground bg-transparent",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        badgeVariants[variant],
        className,
      )}
      {...props}
    />
  );
}

// -------------------------------------------------------------------- Input
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-lg border border-input bg-card/70 px-3 py-2 text-sm",
        "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-20 w-full rounded-lg border border-input bg-card/70 px-3 py-2 text-sm",
      "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

// ------------------------------------------------------------------- Select
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-lg border border-input bg-card/70 px-3 py-2 text-sm",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

// ------------------------------------------------------------------- Switch
export function Switch({
  checked,
  onCheckedChange,
  disabled,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-border",
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

// ---------------------------------------------------------------- Progress
export function Progress({
  value,
  className,
  barClassName,
}: {
  value: number;
  className?: string;
  barClassName?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className={cn("h-full rounded-full bg-primary transition-all duration-500", barClassName)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------- Skeleton
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-lg bg-muted", className)} {...props} />;
}

// ------------------------------------------------------------------ Separator
export function Separator({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-border/70", className)} role="separator" />;
}
