import React from "react";
import { cn } from "@/lib/utils";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: { value: string; label: string }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, helperText, options, children, id, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
    const errorId = error && selectId ? `${selectId}-error` : undefined;
    const helperId = helperText && selectId ? `${selectId}-helper` : undefined;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-xs font-semibold text-neutral-300 tracking-tight"
          >
            {label}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={errorId || helperId}
          className={cn(
            "w-full h-10 px-3 text-sm bg-neutral-900 border rounded-xl text-neutral-100 transition-all duration-150 outline-none cursor-pointer",
            "border-neutral-800 hover:border-neutral-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25",
            error && "border-rose-500/80 focus:border-rose-500 focus:ring-rose-500/25",
            className
          )}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-neutral-900 text-neutral-100">
                  {opt.label}
                </option>
              ))
            : children}
        </select>
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

Select.displayName = "Select";

