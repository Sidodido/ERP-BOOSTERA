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
        "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 border-transparent focus-visible:ring-blue-500",
      secondary:
        "bg-neutral-800/90 hover:bg-neutral-700/90 text-neutral-200 border-neutral-700/80 hover:border-neutral-600 focus-visible:ring-neutral-400",
      outline:
        "bg-transparent hover:bg-neutral-800/60 text-neutral-300 border-neutral-700 hover:border-neutral-500 focus-visible:ring-neutral-400",
      danger:
        "bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border-rose-500/30 hover:border-rose-500/50 focus-visible:ring-rose-500",
      ghost:
        "bg-transparent hover:bg-neutral-800/60 text-neutral-400 hover:text-neutral-100 border-transparent focus-visible:ring-neutral-400",
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

