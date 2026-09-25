import React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", label, error, helperText, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
    const errorId = error && inputId ? `${inputId}-error` : undefined;
    const helperId = helperText && inputId ? `${inputId}-helper` : undefined;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-neutral-300 tracking-tight"
          >
            {label}
          </label>
        )}
        <input
          id={inputId}
          type={type}
          ref={ref}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={errorId || helperId}
          className={cn(
            "w-full h-10 px-3.5 text-sm bg-neutral-900 border rounded-xl text-neutral-100 placeholder:text-neutral-500 transition-all duration-150 outline-none",
            "border-neutral-800 hover:border-neutral-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25",
            error && "border-rose-500/80 focus:border-rose-500 focus:ring-rose-500/25",
            className
          )}
          {...props}
        />
        {error && (
          <p id={errorId} className="text-xs text-rose-400 font-medium">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helperId} className="text-xs text-neutral-500 font-normal">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

