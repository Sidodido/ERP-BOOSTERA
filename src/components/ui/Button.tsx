import React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const variantStyles = {
      primary:
        "bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 bg-[length:200%_auto] hover:bg-[position:right_center] text-white shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/35 border border-white/15 focus-visible:ring-blue-500",
      secondary:
        "bg-neutral-900/80 hover:bg-neutral-800/90 text-neutral-200 border border-white/[0.08] hover:border-white/[0.16] backdrop-blur-md shadow-xs focus-visible:ring-neutral-400",
      outline:
        "bg-transparent hover:bg-white/[0.05] text-neutral-300 border border-white/[0.1] hover:border-white/[0.2] focus-visible:ring-neutral-400",
      danger:
        "bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:border-rose-500/50 shadow-xs shadow-rose-500/10 focus-visible:ring-rose-500",
      ghost:
        "bg-transparent hover:bg-white/[0.06] text-neutral-400 hover:text-white border-transparent focus-visible:ring-neutral-400",
    };

    const sizeStyles = {
      sm: "min-h-[32px] h-8 px-3 text-xs rounded-lg gap-1.5",
      md: "min-h-[38px] h-9 px-4 text-sm rounded-xl gap-2",
      lg: "min-h-[44px] h-11 px-6 text-base rounded-xl gap-2.5",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center font-medium border transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer select-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {isLoading && (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2 shrink-0" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

