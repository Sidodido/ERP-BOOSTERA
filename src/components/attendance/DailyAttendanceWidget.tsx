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
  Coffee,
  Play,
} from "lucide-react";
import {
  getMyAttendanceAction,
  clockInAction,
  clockOutAction,
  startBreakAction,
  endBreakAction,
} from "@/actions/attendance";

interface AttendanceState {
  authenticated: boolean;
  employee?: {
    id: string;
    name: string;
    position: string;
    department: string;
  };
  activeBreak?: {
    isOnBreak: boolean;
    startTime: string | null;
    reason: string | null;
    elapsedMinutes: number;
  };
  today: {
    id: string;
    date: string;
    clockIn: string | null;
    clockOut: string | null;
    status: string;
    breakMinutes: number;
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

  const [showBreakPresets, setShowBreakPresets] = useState(false);

  const handleStartBreak = (reason: string) => {
    setShowBreakPresets(false);
    startTransition(async () => {
      try {
        const res = await startBreakAction(reason);
        setFeedbackMessage(res.message);
        await loadAttendance();
        setTimeout(() => setFeedbackMessage(null), 5000);
      } catch (err: any) {
        alert(err.message || "Erreur lors du démarrage de la pause");
      }
    });
  };

  const handleEndBreak = () => {
    startTransition(async () => {
      try {
        const res = await endBreakAction();
        setFeedbackMessage(res.message);
        await loadAttendance();
        setTimeout(() => setFeedbackMessage(null), 5000);
      } catch (err: any) {
        alert(err.message || "Erreur lors de la fin de pause");
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
              ) : data?.activeBreak?.isOnBreak ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-950/70 text-amber-300 border border-amber-800/60 animate-pulse flex items-center gap-1">
                  <Coffee className="w-3 h-3 text-amber-400" />
                  <span>En Pause ({data.activeBreak.elapsedMinutes}m)</span>
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

      {/* Section Pause Collaborateur (Actif si pointé et journée non terminée) */}
      {isClockedIn && !isClockedOut && (
        <div
          className={`p-4 rounded-xl border transition-all ${
            data?.activeBreak?.isOnBreak
              ? "bg-amber-950/30 border-amber-800/60 shadow-md shadow-amber-950/20"
              : "bg-neutral-950/40 border-neutral-800/80"
          }`}
        >
          {data?.activeBreak?.isOnBreak ? (
            /* Mode Pause Active */
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
                  <Coffee className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                      Pause en Cours : {data.activeBreak.reason || "Standard"}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Démarrée à {formatTimeOnly(data.activeBreak.startTime)} • Durée :{" "}
                    <strong className="text-amber-300 font-mono">
                      {data.activeBreak.elapsedMinutes} min
                    </strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleEndBreak}
                disabled={isPending}
                className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer self-stretch sm:self-auto"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Reprendre le Travail</span>
              </button>
            </div>
          ) : (
            /* Mode Travail Actif (Peut prendre une pause) */
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 shrink-0">
                  <Coffee className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-neutral-200">
                    Pause & Repos Collaborateur
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    {data?.today?.breakMinutes && data.today.breakMinutes > 0
                      ? `${data.today.breakMinutes} min de pause cumulées aujourd'hui`
                      : "Aucune pause prise aujourd'hui"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {showBreakPresets ? (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { label: "Déjeuner 🍽️", reason: "Pause Déjeuner" },
                      { label: "Café ☕", reason: "Pause Café" },
                      { label: "Repos 🌿", reason: "Pause Détente" },
                      { label: "Rapide ⏱️ (15m)", reason: "Pause Rapide" },
                    ].map((p) => (
                      <button
                        key={p.reason}
                        type="button"
                        onClick={() => handleStartBreak(p.reason)}
                        disabled={isPending}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-medium transition cursor-pointer"
                      >
                        {p.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setShowBreakPresets(false)}
                      className="px-2 py-1 text-xs text-neutral-500 hover:text-neutral-300 cursor-pointer"
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowBreakPresets(true)}
                    disabled={isPending}
                    className="py-2 px-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-700/80 hover:border-amber-600/50 text-neutral-200 hover:text-amber-300 text-xs font-semibold transition flex items-center gap-2 cursor-pointer shadow-xs"
                  >
                    <Coffee className="w-3.5 h-3.5 text-amber-400" />
                    <span>Prendre une Pause</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

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
