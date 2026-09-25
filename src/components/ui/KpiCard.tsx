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
      iconBg: "bg-blue-500/10 text-blue-400 border-blue-500/20 group-hover:bg-blue-500/20 group-hover:border-blue-500/40 group-hover:shadow-lg group-hover:shadow-blue-500/20",
      glow: "hover:border-blue-500/30 hover:shadow-blue-500/10",
      accentGlow: "from-blue-600/10 to-transparent",
    },
    emerald: {
      iconBg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 group-hover:bg-emerald-500/20 group-hover:border-emerald-500/40 group-hover:shadow-lg group-hover:shadow-emerald-500/20",
      glow: "hover:border-emerald-500/30 hover:shadow-emerald-500/10",
      accentGlow: "from-emerald-600/10 to-transparent",
    },
    purple: {
      iconBg: "bg-purple-500/10 text-purple-400 border-purple-500/20 group-hover:bg-purple-500/20 group-hover:border-purple-500/40 group-hover:shadow-lg group-hover:shadow-purple-500/20",
      glow: "hover:border-purple-500/30 hover:shadow-purple-500/10",
      accentGlow: "from-purple-600/10 to-transparent",
    },
    amber: {
      iconBg: "bg-amber-500/10 text-amber-400 border-amber-500/20 group-hover:bg-amber-500/20 group-hover:border-amber-500/40 group-hover:shadow-lg group-hover:shadow-amber-500/20",
      glow: "hover:border-amber-500/30 hover:shadow-amber-500/10",
      accentGlow: "from-amber-600/10 to-transparent",
    },
    rose: {
      iconBg: "bg-rose-500/10 text-rose-400 border-rose-500/20 group-hover:bg-rose-500/20 group-hover:border-rose-500/40 group-hover:shadow-lg group-hover:shadow-rose-500/20",
      glow: "hover:border-rose-500/30 hover:shadow-rose-500/10",
      accentGlow: "from-rose-600/10 to-transparent",
    },
    indigo: {
      iconBg: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20 group-hover:bg-indigo-500/20 group-hover:border-indigo-500/40 group-hover:shadow-lg group-hover:shadow-indigo-500/20",
      glow: "hover:border-indigo-500/30 hover:shadow-indigo-500/10",
      accentGlow: "from-indigo-600/10 to-transparent",
    },
  };

  const currentStyle = colorStyles[color] || colorStyles.blue;

  return (
    <div
      className={cn(
        "group relative bg-neutral-900/60 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5 overflow-hidden",
        "shadow-lg shadow-black/20 [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.06)]",
        "transition-all duration-250 ease-out hover:-translate-y-1 hover:shadow-2xl",
        currentStyle.glow
      )}
    >
      {/* Corner Ambient Glow on hover */}
      <div
        className={cn(
          "absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-2xl pointer-events-none",
          currentStyle.accentGlow
        )}
      />

      <div className="flex items-center justify-between relative z-10">
        <span className="text-xs font-semibold tracking-wider uppercase text-neutral-400">
          {title}
        </span>
        <div
          className={cn(
            "p-2.5 rounded-xl border transition-all duration-250",
            currentStyle.iconBg
          )}
        >
          <Icon className="w-4 h-4 transition-transform duration-250 group-hover:scale-110" />
        </div>
      </div>

      <div className="mt-4 flex items-baseline gap-2.5 relative z-10">
        <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-sans">
          {value}
        </span>
        {trend && (
          <span
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border backdrop-blur-sm",
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
        <p className="mt-1.5 text-xs text-neutral-400 font-medium relative z-10">
          {subtitle}
        </p>
      )}
    </div>
  );
}

