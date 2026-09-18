"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Clock,
  CheckCircle2,
  LogIn,
  LogOut,
  Calendar,
  History,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import {
  getMyAttendanceAction,
  clockInAction,
  clockOutAction,
} from "@/actions/attendance";

interface AttendanceState {
  authenticated: boolean;
  employee?: {
    id: string;
    name: string;
    position: string;
    department: string;
  };
  today: {
    id: string;
    date: string;
    clockIn: string | null;
    clockOut: string | null;
    status: string;
    durationMinutes: number;
    isClockedIn: boolean;
    isClockedOut: boolean;
  } | null;
  recentHistory: {
    id: string;
    date: string;
    clockIn: string | null;
    clockOut: string | null;
    status: string;
    durationMinutes: number;
  }[];
}

export function DailyAttendanceWidget() {
  const [data, setData] = useState<AttendanceState | null>(null);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentDateStr, setCurrentDateStr] = useState<string>("");
  const [showHistory, setShowHistory] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Load attendance data
  const loadAttendance = async () => {
    try {
      const res = await getMyAttendanceAction();
      setData(res);
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    loadAttendance();
  }, []);

  // Real-time digital clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
      setCurrentDateStr(
        now.toLocaleDateString("fr-FR", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleClockIn = () => {
    startTransition(async () => {
      try {
        const res = await clockInAction();
        setFeedbackMessage(res.message);
        await loadAttendance();
        setTimeout(() => setFeedbackMessage(null), 5000);
      } catch (err: any) {
        alert(err.message || "Erreur de pointage");
      }
    });
  };

  const handleClockOut = () => {
    startTransition(async () => {
      try {
        const res = await clockOutAction();
        setFeedbackMessage(res.message);
        await loadAttendance();
        setTimeout(() => setFeedbackMessage(null), 5000);
      } catch (err: any) {
        alert(err.message || "Erreur de pointage");
      }
    });
  };

  const isClockedIn = !!data?.today?.clockIn;
  const isClockedOut = !!data?.today?.clockOut;

  const formatTimeOnly = (iso?: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatHoursMins = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${String(m).padStart(2, "0")}m`;
  };

  return (
    <div className="bg-neutral-900/90 border border-neutral-800/90 rounded-2xl p-5 shadow-sm space-y-4">
      {/* Top Banner: Title & Digital Clock */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-neutral-800/60 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-950/60 border border-indigo-800/40 text-indigo-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">
                Pointage Quotidien Collaborateur
              </h2>
              {isClockedOut ? (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-800 text-neutral-300 border border-neutral-700">
                  Journée Terminée
                </span>
              ) : isClockedIn ? (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 animate-pulse">
                  🟢 En Poste
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-950/50 text-amber-400 border border-amber-800/40">
                  ⚪ Non Pointé
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400 capitalize mt-0.5">
              {currentDateStr || "Aujourd'hui"}
            </p>
          </div>
        </div>

        {/* Live Digital Clock */}
        <div className="bg-neutral-950/80 border border-neutral-800 px-3.5 py-1.5 rounded-xl flex items-center gap-2 self-start sm:self-auto">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="font-mono text-base font-bold text-neutral-200 tracking-wider">
            {currentTime || "--:--:--"}
          </span>
        </div>
      </div>

      {/* Main Interaction: Arrival & Exit Buttons / Information */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Step 1: Arrival (Arrivée) */}
        <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-xl p-4 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <LogIn className="w-3.5 h-3.5 text-emerald-400" />
              1. Point d'Arrivée
            </span>
            {isClockedIn && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Enregistré
              </span>
            )}
          </div>

          <div>
            {isClockedIn ? (
              <div className="font-mono font-bold text-xl text-emerald-400">
                {formatTimeOnly(data?.today?.clockIn)}
              </div>
            ) : (
              <div className="text-xs text-neutral-500 italic">
                En attente de pointage d'arrivée...
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleClockIn}
            disabled={isPending || isClockedIn}
            className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              isClockedIn
                ? "bg-emerald-950/30 border border-emerald-800/30 text-emerald-400/80 cursor-default"
                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 cursor-pointer"
            }`}
          >
            <LogIn className="w-4 h-4" />
            {isClockedIn ? "Arrivée Pointée" : "Je pointe mon arrivée"}
          </button>
        </div>

        {/* Step 2: Departure (Sortie) */}
        <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-xl p-4 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <LogOut className="w-3.5 h-3.5 text-amber-400" />
              2. Point de Sortie
            </span>
            {isClockedOut && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Enregistré
              </span>
            )}
          </div>

          <div>
            {isClockedOut ? (
              <div className="font-mono font-bold text-xl text-amber-400">
                {formatTimeOnly(data?.today?.clockOut)}
              </div>
            ) : isClockedIn ? (
              <div className="text-xs text-neutral-400">
                En cours • Cliquez en fin de journée
              </div>
            ) : (
              <div className="text-xs text-neutral-500 italic">
                Pointez l'arrivée d'abord
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleClockOut}
            disabled={isPending || !isClockedIn || isClockedOut}
            className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              isClockedOut
                ? "bg-amber-950/30 border border-amber-800/30 text-amber-400/80 cursor-default"
                : isClockedIn
                ? "bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/20 cursor-pointer"
                : "bg-neutral-800/60 text-neutral-500 border border-neutral-800 cursor-not-allowed"
            }`}
          >
            <LogOut className="w-4 h-4" />
            {isClockedOut ? "Sortie Pointée" : "Je pointe ma sortie"}
          </button>
        </div>

        {/* Step 3: Presence Duration & Summary */}
        <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-xl p-4 flex flex-col justify-between space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            Temps de Présence du Jour
          </span>

          <div>
            <div className="font-mono font-bold text-2xl text-indigo-400">
              {data?.today?.durationMinutes
                ? formatHoursMins(data.today.durationMinutes)
                : "0h 00m"}
            </div>
            <div className="text-[11px] text-neutral-400 mt-0.5">
              {isClockedOut
                ? "Total validé pour la journée"
                : isClockedIn
                ? "Temps écoulé depuis l'arrivée"
                : "Non démarré"}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowHistory((prev) => !prev)}
            className="w-full py-2 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-300 text-xs font-medium transition flex items-center justify-between"
          >
            <span className="flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-neutral-400" />
              Mon historique récent
            </span>
            {showHistory ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Feedback Alert if action just occurred */}
      {feedbackMessage && (
        <div className="bg-emerald-950/60 border border-emerald-800/50 rounded-xl p-3 text-xs text-emerald-300 font-medium flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Recent History Drawer */}
      {showHistory && (
        <div className="pt-3 border-t border-neutral-800/60 space-y-2">
          <div className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
            Pointages des 7 derniers jours :
          </div>
          {data?.recentHistory && data.recentHistory.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {data.recentHistory.map((h) => (
                <div
                  key={h.id}
                  className="bg-neutral-950 p-2.5 rounded-xl border border-neutral-800/80 text-xs space-y-1"
                >
                  <div className="flex justify-between text-neutral-400 font-medium">
                    <span>
                      {new Date(h.date).toLocaleDateString("fr-FR", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                        h.status === "PRESENT"
                          ? "bg-emerald-950 text-emerald-400"
                          : "bg-amber-950 text-amber-400"
                      }`}
                    >
                      {h.status === "PRESENT" ? "À l'heure" : "Retard"}
                    </span>
                  </div>
                  <div className="flex justify-between font-mono text-neutral-300 text-[11px]">
                    <span>Entrée : {formatTimeOnly(h.clockIn)}</span>
                    <span>Sortie : {formatTimeOnly(h.clockOut)}</span>
                  </div>
                  {h.durationMinutes > 0 && (
                    <div className="text-right text-[10px] font-mono text-indigo-400 font-semibold pt-0.5 border-t border-neutral-800/50">
                      Durée : {formatHoursMins(h.durationMinutes)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-neutral-500 italic">
              Aucun historique de pointage antérieur trouvé.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
