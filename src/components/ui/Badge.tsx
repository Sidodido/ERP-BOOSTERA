import React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "outline" | "success" | "warning" | "danger" | "info" | "purple";
  size?: "sm" | "md";
  showDot?: boolean;
}

export function Badge({
  className,
  variant = "default",
  size = "md",
  showDot = true,
  children,
  ...props
}: BadgeProps) {
  const variantStyles = {
    default: {
      badge: "bg-neutral-800/90 text-neutral-300 border-neutral-700/80",
      dot: "bg-neutral-400",
    },
    outline: {
      badge: "bg-transparent text-neutral-400 border-neutral-700",
      dot: "bg-neutral-500",
    },
    success: {
      badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      dot: "bg-emerald-400",
    },
    warning: {
      badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      dot: "bg-amber-400",
    },
    danger: {
      badge: "bg-rose-500/10 text-rose-400 border-rose-500/20",
      dot: "bg-rose-400",
    },
    info: {
      badge: "bg-sky-500/10 text-sky-400 border-sky-500/20",
      dot: "bg-sky-400",
    },
    purple: {
      badge: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      dot: "bg-purple-400",
    },
  };

  const current = variantStyles[variant] || variantStyles.default;

  const sizeStyles = {
    sm: "px-2 py-0.5 text-[11px] gap-1.5",
    md: "px-2.5 py-1 text-xs font-medium gap-1.5",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium transition-all duration-150 tracking-tight",
        current.badge,
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {showDot && (
        <span
          className={cn("w-1.5 h-1.5 rounded-full shrink-0 animate-pulse", current.dot)}
          aria-hidden="true"
        />
      )}
      <span>{children}</span>
    </span>
  );
}

