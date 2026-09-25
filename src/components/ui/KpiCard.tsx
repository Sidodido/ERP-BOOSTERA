import React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  color?: "blue" | "emerald" | "purple" | "amber" | "rose" | "indigo";
}

export function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = "blue",
}: KpiCardProps) {
  const colorStyles = {
    blue: {
      iconBg: "bg-blue-500/10 text-blue-500 border-blue-500/20 group-hover:bg-blue-500/20 group-hover:border-blue-500/30",
      glow: "group-hover:shadow-blue-500/10",
      borderHover: "hover:border-blue-500/30",
    },
    emerald: {
      iconBg: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 group-hover:bg-emerald-500/20 group-hover:border-emerald-500/30",
      glow: "group-hover:shadow-emerald-500/10",
      borderHover: "hover:border-emerald-500/30",
    },
    purple: {
      iconBg: "bg-purple-500/10 text-purple-500 border-purple-500/20 group-hover:bg-purple-500/20 group-hover:border-purple-500/30",
      glow: "group-hover:shadow-purple-500/10",
      borderHover: "hover:border-purple-500/30",
    },
    amber: {
      iconBg: "bg-amber-500/10 text-amber-500 border-amber-500/20 group-hover:bg-amber-500/20 group-hover:border-amber-500/30",
      glow: "group-hover:shadow-amber-500/10",
      borderHover: "hover:border-amber-500/30",
    },
    rose: {
      iconBg: "bg-rose-500/10 text-rose-500 border-rose-500/20 group-hover:bg-rose-500/20 group-hover:border-rose-500/30",
      glow: "group-hover:shadow-rose-500/10",
      borderHover: "hover:border-rose-500/30",
    },
    indigo: {
      iconBg: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20 group-hover:bg-indigo-500/20 group-hover:border-indigo-500/30",
      glow: "group-hover:shadow-indigo-500/10",
      borderHover: "hover:border-indigo-500/30",
    },
  };

  const currentStyle = colorStyles[color] || colorStyles.blue;

  return (
    <div
      className={cn(
        "group relative bg-neutral-900/80 backdrop-blur-md border border-neutral-800/80 rounded-2xl p-5",
        "transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-xl",
        "before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-b before:from-white/[0.03] before:to-transparent before:pointer-events-none",
        currentStyle.borderHover,
        currentStyle.glow
      )}
    >
      <div className="flex items-center justify-between relative z-10">
        <span className="text-xs font-semibold tracking-wide uppercase text-neutral-400">
          {title}
        </span>
        <div
          className={cn(
            "p-2.5 rounded-xl border transition-all duration-200",
            currentStyle.iconBg
          )}
        >
          <Icon className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />
        </div>
      </div>

      <div className="mt-4 flex items-baseline gap-2.5 relative z-10">
        <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-100 font-sans">
          {value}
        </span>
        {trend && (
          <span
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border",
              trend.isPositive
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-rose-500/10 text-rose-400 border-rose-500/20"
            )}
          >
            {trend.isPositive ? (
              <TrendingUp className="w-3 h-3 shrink-0" />
            ) : (
              <TrendingDown className="w-3 h-3 shrink-0" />
            )}
            <span>
              {trend.isPositive ? "+" : ""}
              {trend.value}
            </span>
          </span>
        )}
      </div>

      {subtitle && (
        <p className="mt-1.5 text-xs text-neutral-500 font-medium relative z-10">
          {subtitle}
        </p>
      )}
    </div>
  );
}

