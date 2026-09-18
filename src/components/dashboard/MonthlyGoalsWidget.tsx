"use client";

import React from "react";
import Link from "next/link";
import {
  Target,
  PhoneCall,
  Calendar,
  Users,
  TrendingUp,
  Video,
  Palette,
  Sparkles,
  CheckCircle2,
  Flame,
  Clock,
  ArrowUpRight,
  Award,
} from "lucide-react";
import type { MonthlyGoalDisplay } from "@/lib/goals-sync";
import { formatCurrency } from "@/lib/utils";

interface MonthlyGoalsWidgetProps {
  goals: MonthlyGoalDisplay[];
  month?: number;
  year?: number;
  userName?: string;
  showAdminLink?: boolean;
}

const MONTH_NAMES = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

export function MonthlyGoalsWidget({
  goals = [],
  month,
  year,
  userName,
  showAdminLink = false,
}: MonthlyGoalsWidgetProps) {
  const currentMonthNum = month || new Date().getMonth() + 1;
  const currentYearNum = year || new Date().getFullYear();
  const monthName = MONTH_NAMES[currentMonthNum - 1] || "";

  const totalGoals = goals.length;
  const completedGoals = goals.filter((g) => g.achievedValue >= g.targetValue).length;

  const getMetricIcon = (metric: string) => {
    switch (metric.toUpperCase()) {
      case "APPELS":
        return <PhoneCall className="w-5 h-5 text-emerald-400" />;
      case "RENDEZ_VOUS":
        return <Calendar className="w-5 h-5 text-purple-400" />;
      case "CLIENTS":
        return <Users className="w-5 h-5 text-blue-400" />;
      case "CA":
      case "CA_DA":
        return <TrendingUp className="w-5 h-5 text-amber-400" />;
      case "VIDEOS":
        return <Video className="w-5 h-5 text-rose-400" />;
      case "DESIGNS":
      case "CREATIONS":
        return <Palette className="w-5 h-5 text-indigo-400" />;
      default:
        return <Target className="w-5 h-5 text-indigo-400" />;
    }
  };

  const getMetricBadgeStyle = (metric: string) => {
    switch (metric.toUpperCase()) {
      case "APPELS":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "RENDEZ_VOUS":
        return "bg-purple-500/10 text-purple-400 border-purple-500/30";
      case "CLIENTS":
        return "bg-blue-500/10 text-blue-400 border-blue-500/30";
      case "CA":
      case "CA_DA":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      case "VIDEOS":
        return "bg-rose-500/10 text-rose-400 border-rose-500/30";
      default:
        return "bg-indigo-500/10 text-indigo-400 border-indigo-500/30";
    }
  };

  if (totalGoals === 0) {
    return (
      <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
            <Target className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-neutral-200">
                Objectifs Mensuels ({monthName} {currentYearNum})
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-800 text-neutral-400 border border-neutral-700">
                Non assigné
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Aucun objectif fixé pour ce mois. Vos activités restent automatiquement enregistrées.
            </p>
          </div>
        </div>
        {showAdminLink && (
          <Link
            href="/equipes?tab=GOALS"
            className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-600/30 transition flex items-center gap-1.5 shrink-0"
          >
            <span>Fixer un objectif</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Widget */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
            <Target className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-neutral-100">
                Mes Objectifs du Mois
              </h2>
              <span className="px-2 py-0.5 rounded-md bg-indigo-950/60 text-indigo-300 text-[11px] font-semibold border border-indigo-800/40">
                {monthName} {currentYearNum}
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/50 text-emerald-400 text-[10px] font-bold border border-emerald-800/40">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Synchronisé en direct
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Progression calculée automatiquement d'après vos actions réelles enregistrées.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs font-medium text-neutral-300 bg-neutral-900 px-3 py-1.5 rounded-xl border border-neutral-800 flex items-center gap-2">
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <span>
              <strong className="text-emerald-400">{completedGoals}</strong> / {totalGoals} objectifs atteints
            </span>
          </div>
          <Link
            href="/equipes?tab=GOALS"
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition"
          >
            <span>Détails</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Grid of Goals Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {goals.map((goal) => {
          const isOverachieved = goal.achievedValue > goal.targetValue;
          const isReached = goal.achievedValue >= goal.targetValue;
          const progressPercent = goal.progressPercentage;
          const barWidth = Math.min(100, progressPercent);

          const remaining = Math.max(0, goal.targetValue - goal.achievedValue);
          const surplus = Math.max(0, goal.achievedValue - goal.targetValue);

          const isCA = goal.metric === "CA" || goal.metric === "CA_DA";

          return (
            <div
              key={goal.id}
              className={`relative overflow-hidden rounded-2xl p-5 border transition-all shadow-sm ${
                isReached
                  ? "bg-gradient-to-b from-emerald-950/20 via-neutral-900/80 to-neutral-900/90 border-emerald-500/30 hover:border-emerald-500/50"
                  : progressPercent >= 70
                  ? "bg-gradient-to-b from-amber-950/15 via-neutral-900/80 to-neutral-900/90 border-amber-500/30 hover:border-amber-500/50"
                  : "bg-neutral-900/80 border-neutral-800 hover:border-neutral-700"
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center border ${getMetricBadgeStyle(
                      goal.metric
                    )}`}
                  >
                    {getMetricIcon(goal.metric)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-neutral-100">
                      {goal.metricLabel}
                    </h3>
                    <span className="text-[11px] text-neutral-400 capitalize">
                      {goal.unit}
                    </span>
                  </div>
                </div>

                {/* Status Badge */}
                <div>
                  {isOverachieved ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                      <Flame className="w-3 h-3 text-emerald-400" />
                      Dépassement 🚀
                    </span>
                  ) : isReached ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      Atteint 🎯
                    </span>
                  ) : progressPercent >= 70 ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      <Flame className="w-3 h-3 text-amber-400" />
                      En très bonne voie 🔥
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-neutral-800 text-neutral-300 border border-neutral-700">
                      <Clock className="w-3 h-3 text-neutral-400" />
                      En cours ⏳
                    </span>
                  )}
                </div>
              </div>

              {/* Numbers Display */}
              <div className="flex items-baseline justify-between pt-1 pb-2">
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className={`text-2xl font-black font-mono tracking-tight ${
                        isReached
                          ? "text-emerald-400"
                          : progressPercent >= 70
                          ? "text-amber-400"
                          : "text-neutral-100"
                      }`}
                    >
                      {isCA ? formatCurrency(goal.achievedValue) : goal.achievedValue}
                    </span>
                    <span className="text-xs text-neutral-500 font-mono">
                      / {isCA ? formatCurrency(goal.targetValue) : goal.targetValue} {goal.unit}
                    </span>
                  </div>
                  <span className="text-[11px] text-neutral-400 font-medium">
                    Réalisé ce mois
                  </span>
                </div>

                <div className="text-right">
                  <span
                    className={`text-xl font-black font-mono ${
                      isReached
                        ? "text-emerald-400"
                        : progressPercent >= 70
                        ? "text-amber-400"
                        : "text-neutral-200"
                    }`}
                  >
                    {progressPercent}%
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-neutral-950 h-2.5 rounded-full overflow-hidden border border-neutral-800/80 p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isReached
                      ? "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-sm shadow-emerald-500/50"
                      : progressPercent >= 70
                      ? "bg-gradient-to-r from-amber-500 to-yellow-400"
                      : "bg-gradient-to-r from-indigo-600 to-blue-500"
                  }`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>

              {/* Motivational Footer */}
              <div className="mt-3 pt-2.5 border-t border-neutral-800/60 flex items-center justify-between text-[11px]">
                {isReached ? (
                  <span className="text-emerald-400 font-medium flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    {isOverachieved
                      ? `Objectif validé ! +${surplus} ${goal.unit} au-delà de la cible.`
                      : "Bravo ! Objectif mensuel parfaitement validé."}
                  </span>
                ) : (
                  <span className="text-neutral-400 font-medium">
                    Plus que <strong className="text-neutral-200">{remaining} {goal.unit}</strong> pour valider la cible.
                  </span>
                )}

                <span className="text-[10px] text-neutral-500 font-mono">
                  {goal.metric}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
