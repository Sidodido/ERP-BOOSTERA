import React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

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
    blue: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    emerald: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    purple: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    amber: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    rose: "bg-rose-500/10 text-rose-500 border-rose-500/20",
    indigo: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  };

  return (
    <div className="bg-neutral-900/80 backdrop-blur-xs border border-neutral-800/80 rounded-2xl p-5 hover:border-neutral-700/80 transition-all duration-200">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-neutral-400">{title}</span>
        <div className={cn("p-2 rounded-xl border", colorStyles[color])}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-neutral-100">
          {value}
        </span>
        {trend && (
          <span
            className={cn(
              "text-xs font-medium",
              trend.isPositive ? "text-emerald-400" : "text-rose-400"
            )}
          >
            {trend.isPositive ? "+" : ""}
            {trend.value}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="mt-1 text-xs text-neutral-500">{subtitle}</p>
      )}
    </div>
  );
}
