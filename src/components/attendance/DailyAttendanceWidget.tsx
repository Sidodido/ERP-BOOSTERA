"use client";

import React, { useState, useEffect, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
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
  AlertTriangle,
  AlertCircle,
  Volume2,
  VolumeX,
  X,
  ChevronRight,
  Info,
  Flame,
  ShieldAlert,
  Users,
  Search,
  RefreshCw,
  Zap,
  UtensilsCrossed,
} from "lucide-react";
import {
  getMyAttendanceAction,
  clockInAction,
  clockOutAction,
  startBreakAction,
  endBreakAction,
  resumeActivityAction,
  getMyBreaksHistoryAction,
  BreakSessionItem,
  DayBreakSummary,
} from "@/actions/attendance";
import {
  getTodayAllUsersBreaksAction,
  type EmployeeTodayBreak,
} from "@/actions/rh";
import {
  playNotificationSound,
  playWarningSound,
  playUrgentSound,
  isNotificationSoundEnabled,
  setNotificationSoundEnabled,
} from "@/lib/sound";

function broadcastAttendanceSync() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("crm:attendance-updated"));
    try {
      const bc = new BroadcastChannel("crm_attendance_sync");
      bc.postMessage({ timestamp: Date.now() });
      bc.close();
    } catch {}
  }
}

interface AttendanceState {
  authenticated: boolean;
  userRole?: string;
  isCommercial?: boolean;
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
    isAutoDetected?: boolean;
  };
  todayBreaks?: BreakSessionItem[];
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
  const router = useRouter();
  const [data, setData] = useState<AttendanceState | null>(null);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentDateStr, setCurrentDateStr] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPending, startTransition] = useTransition();
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  // Breaks specifics
  const [showTodayBreaksDetail, setShowTodayBreaksDetail] = useState<boolean>(false);
  const [liveElapsedBreakMinutes, setLiveElapsedBreakMinutes] = useState<number>(0);

  // Détection rôle commercial
  const isCommercial =
    data?.isCommercial ??
    (data?.userRole === "SALES_REP" ||
      data?.userRole === "SALES_DIRECTOR" ||
      (data?.userRole as any) === "COMMERCIAL" ||
      data?.employee?.department === "COMMERCIAL");

  // Pour les commerciaux : les pauses automatiques d'inactivité ne sont JAMAIS actives
  const isEffectivelyOnBreak = isCommercial
    ? Boolean(data?.activeBreak?.isOnBreak && !data.activeBreak.isAutoDetected)
    : Boolean(data?.activeBreak?.isOnBreak);

  // Breaks History Modal
  // Breaks History & Team Breaks Modal
  const [showBreaksHistoryModal, setShowBreaksHistoryModal] = useState<boolean>(false);
  const [modalTab, setModalTab] = useState<"MY_BREAKS" | "ALL_USERS">("ALL_USERS");
  const [historyDaysCount, setHistoryDaysCount] = useState<number>(14);
  const [breaksHistoryData, setBreaksHistoryData] = useState<{
    history: DayBreakSummary[];
    stats: {
      totalMinutesAll: number;
      totalBreaksCount: number;
      averageMinutesPerDay: number;
      exceededDaysCount: number;
      daysCount: number;
    };
  } | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  // All Users Breaks State (Pauses Aujourd'hui pour tous les utilisateurs)
  const [allUsersBreaksData, setAllUsersBreaksData] = useState<{
    breaks: EmployeeTodayBreak[];
    kpis: {
      totalEmployees: number;
      clockedInCount: number;
      currentlyOnBreak: number;
      totalCompanyBreakMinutes: number;
      exceededCount: number;
    };
  } | null>(null);
  const [isLoadingAllUsersBreaks, setIsLoadingAllUsersBreaks] = useState<boolean>(false);
  const [allUsersSearch, setAllUsersSearch] = useState<string>("");
  const [expandedAllUserEmployeeId, setExpandedAllUserEmployeeId] = useState<string | null>(null);

  // Audio Alerts state
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const alertPlayedRef = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
    setSoundEnabled(isNotificationSoundEnabled());
  }, []);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    setNotificationSoundEnabled(next);
    if (next) {
      playNotificationSound(true);
    }
  };

  const loadAttendance = async () => {
    try {
      const res = await getMyAttendanceAction();
      if (res && res.authenticated) {
        setData(res as AttendanceState);
      }
    } catch {
      // Ignored
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAttendance();

    const handleSync = () => loadAttendance();
    window.addEventListener("crm:attendance-updated", handleSync);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("crm_attendance_sync");
      bc.onmessage = handleSync;
    } catch {}

    const intervalAtt = setInterval(loadAttendance, 30000);

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
    return () => {
      clearInterval(interval);
      clearInterval(intervalAtt);
      window.removeEventListener("crm:attendance-updated", handleSync);
      if (bc) bc.close();
    };
  }, []);

  // Recalculate live elapsed minutes for ongoing break every 3 seconds
  useEffect(() => {
    if (isEffectivelyOnBreak && data?.activeBreak?.startTime) {
      const calc = () => {
        const startMs = new Date(data.activeBreak!.startTime!).getTime();
        const diffMin = Math.max(0, Math.floor((Date.now() - startMs) / 60000));
        setLiveElapsedBreakMinutes(diffMin);
      };
      calc();
      const intv = setInterval(calc, 3000);
      return () => clearInterval(intv);
    } else {
      setLiveElapsedBreakMinutes(0);
    }
  }, [isEffectivelyOnBreak, data?.activeBreak?.startTime]);

  // Alert triggers with audible chime
  useEffect(() => {
    if (!isEffectivelyOnBreak || !data?.activeBreak?.startTime) return;
    if (isCommercial && data.activeBreak.isAutoDetected) return;

    const startIso = data.activeBreak.startTime;
    const reason = (data.activeBreak.reason || "").toLowerCase();
    const isLunch = reason.includes("déjeuner") || reason.includes("dejeuner") || isCommercial;
    const limit = isLunch ? 45 : 15;

    // 1. Critical Alert (> 120 min)
    if (liveElapsedBreakMinutes >= 120 && !alertPlayedRef.current[`crit_${startIso}`]) {
      alertPlayedRef.current[`crit_${startIso}`] = true;
      if (soundEnabled) playUrgentSound(true);
    }
    // 2. Warning limit exceeded (> 15m or > 45m)
    else if (liveElapsedBreakMinutes > limit && !alertPlayedRef.current[`warn_${startIso}`]) {
      alertPlayedRef.current[`warn_${startIso}`] = true;
      if (soundEnabled) playWarningSound(true);
    }
  }, [
    liveElapsedBreakMinutes,
    isEffectivelyOnBreak,
    data?.activeBreak?.startTime,
    data?.activeBreak?.reason,
    data?.activeBreak?.isAutoDetected,
    isCommercial,
    soundEnabled,
  ]);

  // Daily quota warning alert (> 60 min)
  useEffect(() => {
    const todayTotal =
      (data?.today?.breakMinutes || 0) +
      (data?.activeBreak?.isOnBreak ? liveElapsedBreakMinutes : 0);
    const todayKey = data?.today?.date || "today";

    if (todayTotal > 60 && !alertPlayedRef.current[`quota_${todayKey}`]) {
      alertPlayedRef.current[`quota_${todayKey}`] = true;
      if (soundEnabled) playWarningSound(true);
    }
  }, [
    data?.today?.breakMinutes,
    data?.today?.date,
    liveElapsedBreakMinutes,
    data?.activeBreak?.isOnBreak,
    soundEnabled,
  ]);

  const handleClockIn = () => {
    startTransition(async () => {
      try {
        const res = await clockInAction();
        setFeedbackMessage(res.message);
        playNotificationSound();
        await loadAttendance();
        broadcastAttendanceSync();
        router.refresh();
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
        playNotificationSound();
        await loadAttendance();
        broadcastAttendanceSync();
        router.refresh();
        setTimeout(() => setFeedbackMessage(null), 5000);
      } catch (err: any) {
        alert(err.message || "Erreur de pointage");
      }
    });
  };

  const handleStartBreak = (reason: string = "Pause Déjeuner") => {
    startTransition(async () => {
      try {
        const res = await startBreakAction(reason);
        setFeedbackMessage(res.message);
        playNotificationSound();
        await loadAttendance();
        broadcastAttendanceSync();
        router.refresh();
        setTimeout(() => setFeedbackMessage(null), 5000);
      } catch (err: any) {
        alert(err.message || "Erreur lors du démarrage de la pause");
      }
    });
  };

  const handleEndBreak = () => {
    startTransition(async () => {
      try {
        if (data?.activeBreak?.isAutoDetected) {
          await resumeActivityAction();
          setFeedbackMessage("Activité reprise avec succès. Vous êtes à nouveau au poste !");
        } else {
          const res = await endBreakAction();
          setFeedbackMessage(res.message);
        }
        playNotificationSound();
        await loadAttendance();
        broadcastAttendanceSync();
        router.refresh();
        setTimeout(() => setFeedbackMessage(null), 5000);
      } catch (err: any) {
        alert(err.message || "Erreur lors de la fin de pause");
      }
    });
  };

  const loadBreaksHistory = async (days: number = historyDaysCount) => {
    setIsLoadingHistory(true);
    try {
      const res = await getMyBreaksHistoryAction(days);
      if (res && res.success) {
        setBreaksHistoryData({
          history: res.history,
          stats: res.stats,
        });
      }
    } catch (err) {
      console.error("Erreur chargement historique pauses:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const loadAllUsersBreaks = async () => {
    setIsLoadingAllUsersBreaks(true);
    try {
      const res = await getTodayAllUsersBreaksAction();
      if (res && res.success) {
        setAllUsersBreaksData({
          breaks: res.breaks,
          kpis: res.kpis,
        });
      }
    } catch (err) {
      console.error("Erreur chargement pauses tous utilisateurs:", err);
    } finally {
      setIsLoadingAllUsersBreaks(false);
    }
  };

  const openBreaksHistoryModal = (targetTab: "MY_BREAKS" | "ALL_USERS" = "ALL_USERS") => {
    setModalTab(targetTab);
    setShowBreaksHistoryModal(true);
    if (targetTab === "MY_BREAKS") {
      loadBreaksHistory(historyDaysCount);
    } else {
      loadAllUsersBreaks();
    }
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
    if (h === 0) return `${m} min`;
    return `${h}h ${String(m).padStart(2, "0")}m`;
  };

  // Warning metrics calculation
  const currentElapsed = isEffectivelyOnBreak ? liveElapsedBreakMinutes : 0;
  const totalBreaksMinutesToday = (data?.today?.breakMinutes || 0) + currentElapsed;
  const quotaLimit = 40; // 40 min daily limit
  const isDailyQuotaExceeded = totalBreaksMinutesToday > quotaLimit;
  const isDailyQuotaHigh = totalBreaksMinutesToday > 60;

  const activeReason = (data?.activeBreak?.reason || "").toLowerCase();
  const isActiveLunch =
    activeReason.includes("déjeuner") ||
    activeReason.includes("dejeuner") ||
    isCommercial;
  const activeRecommendedLimit = isActiveLunch ? 45 : 15;
  const isActiveBreakExceeded =
    isEffectivelyOnBreak && currentElapsed > activeRecommendedLimit;
  const isActiveBreakCritical = isEffectivelyOnBreak && currentElapsed >= 120;

  // Filtrage des pauses aujourd'hui (sans auto-détectées pour les commerciaux)
  const displayTodayBreaks = isCommercial
    ? (data?.todayBreaks || []).filter((b) => !b.isAutoDetected)
    : (data?.todayBreaks || []);

  return (
    <div className="bg-neutral-900/90 border border-neutral-800/90 rounded-2xl p-5 shadow-sm space-y-4">
      {/* Top Banner: Title, Sound Toggle & Digital Clock */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-neutral-800/60 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-950/60 border border-indigo-800/40 text-indigo-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">
                Pointage Quotidien Collaborateur
              </h2>
              {isClockedOut ? (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-800 text-neutral-300 border border-neutral-700">
                  Journée Terminée
                </span>
              ) : data?.activeBreak?.isOnBreak ? (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border flex items-center gap-1 animate-pulse ${
                    isActiveBreakCritical
                      ? "bg-rose-950/80 text-rose-300 border-rose-800"
                      : isActiveBreakExceeded
                      ? "bg-amber-950/80 text-amber-300 border-amber-700"
                      : "bg-amber-950/70 text-amber-300 border-amber-800/60"
                  }`}
                >
                  <Coffee className="w-3 h-3 text-amber-400" />
                  <span>
                    En Pause ({liveElapsedBreakMinutes}m)
                    {isActiveBreakExceeded && " ⚠️"}
                  </span>
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

        {/* Right Controls: Sound Alert Switch & Digital Clock */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {/* Sound toggle button */}
          <button
            type="button"
            onClick={toggleSound}
            title={
              soundEnabled
                ? "Sons d'alertes & notifications activés (cliquer pour couper)"
                : "Sons d'alertes désactivés (cliquer pour activer)"
            }
            className={`p-2 rounded-xl border text-xs font-medium transition flex items-center gap-1.5 cursor-pointer ${
              soundEnabled
                ? "bg-neutral-850 hover:bg-neutral-800 border-neutral-700 text-neutral-300 hover:text-white"
                : "bg-neutral-900 border-neutral-800 text-neutral-500 hover:text-neutral-400"
            }`}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-neutral-500" />
            )}
            <span className="hidden md:inline text-[11px]">
              {soundEnabled ? "Sons On" : "Muet"}
            </span>
          </button>

          {/* Live Digital Clock */}
          <div className="bg-neutral-950/80 border border-neutral-800 px-3.5 py-1.5 rounded-xl flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="font-mono text-base font-bold text-neutral-200 tracking-wider">
              {currentTime || "--:--:--"}
            </span>
          </div>
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
                : "0 min"}
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
            className="w-full py-2 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-300 text-xs font-medium transition flex items-center justify-between cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-neutral-400" />
              Mon pointage récent
            </span>
            {showHistory ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION PAUSES, ALERTES & WARNINGS DU COLLABORATEUR      */}
      {/* ======================================================== */}
      {isClockedIn && (
        <div className="space-y-3 pt-1">
          {/* CRITICAL WARNING BANNER : PAUSE OUBLIEE > 2H */}
          {isActiveBreakCritical && (
            <div className="bg-rose-950/70 border border-rose-600/80 rounded-xl p-3.5 text-rose-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-lg shadow-rose-950/30 animate-pulse">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-rose-300">
                    Alerte Critique : Pause prolongée ({liveElapsedBreakMinutes} min)
                  </div>
                  <div className="text-xs text-rose-200/90 mt-0.5">
                    Vous êtes en pause depuis plus de 2 heures. Avez-vous oublié de reprendre votre poste ?
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleEndBreak}
                disabled={isPending}
                className="py-2 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition shrink-0 cursor-pointer shadow-md"
              >
                Reprendre le travail immédiatement
              </button>
            </div>
          )}

          {/* ACTIVE WARNING BANNER : PAUSE DEPASSEE (> 15m ou > 45m) */}
          {isActiveBreakExceeded && !isActiveBreakCritical && (!isCommercial || !data?.activeBreak?.isAutoDetected) && (
            <div className="bg-amber-950/60 border border-amber-600/70 rounded-xl p-3 text-amber-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-md">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-amber-300">
                    Avertissement : Durée de pause conseillée dépassée
                  </div>
                  <div className="text-[11px] text-amber-200/90 mt-0.5">
                    Votre pause « {data?.activeBreak?.reason || "Pause Déjeuner"} » dure depuis{" "}
                    <strong>{liveElapsedBreakMinutes} min</strong> (seuil recommandé :{" "}
                    {activeRecommendedLimit} min, dépassement de +
                    {liveElapsedBreakMinutes - activeRecommendedLimit} min).
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleEndBreak}
                disabled={isPending}
                className="py-1.5 px-3.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-neutral-950 font-bold text-xs transition shrink-0 cursor-pointer"
              >
                Fin de pause
              </button>
            </div>
          )}

          {/* DAILY QUOTA WARNING BANNER (> 40 min ou > 60 min) */}
          {isDailyQuotaExceeded && (
            <div
              className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                isDailyQuotaHigh
                  ? "bg-rose-950/40 border-rose-800/60 text-rose-300"
                  : "bg-amber-950/40 border-amber-800/50 text-amber-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  <strong>Limite quotidienne de pause dépassée :</strong>{" "}
                  {totalBreaksMinutesToday} min cumulées aujourd'hui (consigne de ne pas dépasser 40 min/jour
                  dépassée de +{totalBreaksMinutesToday - quotaLimit} min).
                </span>
              </div>
              <span className="font-mono font-bold text-[11px] shrink-0 px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800">
                {totalBreaksMinutesToday}m / 40m
              </span>
            </div>
          )}

          {/* MAIN BREAK CARD (Active Break or Start Break Controls) */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              isEffectivelyOnBreak
                ? isActiveBreakCritical
                  ? "bg-rose-950/20 border-rose-800/60 shadow-lg"
                  : isActiveBreakExceeded
                  ? "bg-amber-950/40 border-amber-700/60 shadow-md shadow-amber-950/20"
                  : "bg-amber-950/30 border-amber-800/60 shadow-md shadow-amber-950/20"
                : "bg-neutral-950/50 border-neutral-800/80"
            }`}
          >
            {isEffectivelyOnBreak ? (
              /* Mode Pause Active */
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-3 rounded-xl border shrink-0 ${
                      isActiveBreakCritical
                        ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                        : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                    }`}
                  >
                    {!isCommercial && data?.activeBreak?.isAutoDetected ? (
                      <Zap className="w-5 h-5 text-amber-400 animate-pulse" />
                    ) : (
                      <UtensilsCrossed className="w-5 h-5 text-amber-400 animate-bounce" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                        {!isCommercial && data?.activeBreak?.isAutoDetected
                          ? "Pause Automatique (Inactivité > 15m)"
                          : data?.activeBreak?.reason || "Pause Déjeuner en Cours"}
                      </span>
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    </div>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Démarrée à {formatTimeOnly(data?.activeBreak?.startTime)} • Durée :{" "}
                      <strong
                        className={`font-mono ${
                          isActiveBreakExceeded ? "text-amber-300" : "text-neutral-200"
                        }`}
                      >
                        {liveElapsedBreakMinutes} min
                      </strong>{" "}
                      {isActiveBreakExceeded && (
                        <span className="text-[11px] text-amber-400 font-semibold">
                          (Dépassement recommandé de {activeRecommendedLimit}m)
                        </span>
                      )}
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
                  <span>
                    {!isCommercial && data?.activeBreak?.isAutoDetected
                      ? "Je suis au poste (Reprendre)"
                      : "Reprendre le Travail"}
                  </span>
                </button>
              </div>
            ) : (
              /* Mode Travail Actif (Bouton manuel Pause Déjeuner) */
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 shrink-0">
                    <UtensilsCrossed className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-neutral-200">
                        Pause Déjeuner Collaborateur
                      </span>
                      {displayTodayBreaks.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700">
                          {displayTodayBreaks.length} pause(s)
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-400">
                      {totalBreaksMinutesToday > 0
                        ? `${totalBreaksMinutesToday} min de pause cumulées aujourd'hui`
                        : "Aucune pause prise aujourd'hui"}
                    </p>
                  </div>
                </div>

                {!isClockedOut && (
                  <button
                    type="button"
                    onClick={() => handleStartBreak("Pause Déjeuner")}
                    disabled={isPending}
                    className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-neutral-950 font-bold text-xs transition flex items-center justify-center gap-2 shadow-md shadow-amber-600/20 cursor-pointer disabled:opacity-50"
                  >
                    <UtensilsCrossed className="w-4 h-4 text-neutral-950" />
                    <span>Pause Déjeuner</span>
                  </button>
                )}
              </div>
            )}

            {/* Daily Quota Progress Bar */}
            <div className="mt-3 pt-3 border-t border-neutral-800/60">
              <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <span>Ne pas dépasser 40 min/jour :</span>
                  <strong
                    className={
                      isDailyQuotaExceeded
                        ? "text-rose-400"
                        : totalBreaksMinutesToday >= 30
                        ? "text-amber-400"
                        : "text-emerald-400"
                    }
                  >
                    {totalBreaksMinutesToday} min / 40 min
                  </strong>
                </span>
                <span className="font-mono text-[10px]">
                  {Math.round((totalBreaksMinutesToday / 40) * 100)}%
                </span>
              </div>
              <div className="w-full bg-neutral-950 rounded-full h-1.5 overflow-hidden border border-neutral-800/80">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isDailyQuotaExceeded
                      ? "bg-rose-500"
                      : totalBreaksMinutesToday >= 30
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}
                  style={{
                    width: `${Math.min(100, Math.round((totalBreaksMinutesToday / 40) * 100))}%`,
                  }}
                />
              </div>
            </div>

            {/* Interactive Links: Today's Breaks Details & Full History Modal */}
            <div className="mt-3 flex items-center justify-between gap-2 flex-wrap text-xs">
              <button
                type="button"
                onClick={() => setShowTodayBreaksDetail((prev) => !prev)}
                className="text-neutral-400 hover:text-neutral-200 transition flex items-center gap-1 text-[11px] cursor-pointer"
              >
                <span>
                  {showTodayBreaksDetail
                    ? "Masquer les pauses d'aujourd'hui"
                    : `Détail des pauses d'aujourd'hui (${displayTodayBreaks.length})`}
                </span>
                {showTodayBreaksDetail ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => openBreaksHistoryModal("ALL_USERS")}
                  className="py-1 px-2.5 rounded-lg bg-indigo-950/40 hover:bg-indigo-950/70 border border-indigo-800/60 text-indigo-300 hover:text-indigo-200 text-[11px] font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Pauses Aujourd'hui (Tous)</span>
                </button>

                <button
                  type="button"
                  onClick={() => openBreaksHistoryModal("MY_BREAKS")}
                  className="py-1 px-2.5 rounded-lg bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-amber-300/90 hover:text-amber-200 text-[11px] font-medium transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <History className="w-3.5 h-3.5 text-amber-400" />
                  <span>Mon Historique</span>
                </button>
              </div>
            </div>

            {/* Sub-drawer: Today's Break Sessions List */}
            {showTodayBreaksDetail && (
              <div className="mt-3 pt-3 border-t border-neutral-800/70 space-y-2">
                <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                  Sessions de pause aujourd'hui :
                </div>
                {displayTodayBreaks && displayTodayBreaks.length > 0 ? (
                  <div className="space-y-1.5">
                    {displayTodayBreaks.map((b, idx) => {
                      const isLunch = b.reason.toLowerCase().includes("déjeuner");
                      const lim = isLunch ? 45 : 15;
                      const isOver = b.durationMinutes > lim;
                      return (
                        <div
                          key={b.id || idx}
                          className="bg-neutral-950 p-2 rounded-lg border border-neutral-850 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className={b.isAutoDetected ? "text-indigo-400" : "text-amber-400"}>
                              {b.isAutoDetected ? "🤖" : "☕"}
                            </span>
                            <span className="font-medium text-neutral-200">{b.reason}</span>
                            {b.isAutoDetected && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/50">
                                Auto &gt;15m
                              </span>
                            )}
                            <span className="text-[11px] text-neutral-500 font-mono">
                              ({formatTimeOnly(b.startTime)} -{" "}
                              {b.isOngoing ? "En cours..." : formatTimeOnly(b.endTime)})
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {b.isOngoing ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-amber-950 text-amber-300 border border-amber-800 animate-pulse">
                                  {liveElapsedBreakMinutes} min (En cours)
                                </span>
                                {b.isAutoDetected && (
                                  <button
                                    type="button"
                                    onClick={handleEndBreak}
                                    className="text-[10px] px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                                  >
                                    Au poste
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                  isOver
                                    ? "bg-amber-950 text-amber-300 border border-amber-800"
                                    : "bg-emerald-950 text-emerald-400 border border-emerald-800/50"
                                }`}
                              >
                                {b.durationMinutes} min {isOver && `(+${b.durationMinutes - lim}m)`}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-neutral-500 italic">
                    Aucune pause prise pour l'instant aujourd'hui.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Feedback Alert if action just occurred */}
      {feedbackMessage && (
        <div className="bg-emerald-950/60 border border-emerald-800/50 rounded-xl p-3 text-xs text-emerald-300 font-medium flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Recent Attendance History Drawer (Points d'arrivée/sortie des 7 derniers jours) */}
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
                      Présence : {formatHoursMins(h.durationMinutes)}
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

      {/* ======================================================== */}
      {/* POPUP MODAL : HISTORIQUE & BILAN COMPLET DES PAUSES      */}
      {/* (Fermeture automatique au clic à l'extérieur)             */}
      {/* ======================================================== */}
      {showBreaksHistoryModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowBreaksHistoryModal(false);
            }
          }}
        >
          <div
            className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/70">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-800/50 text-amber-400">
                  <Coffee className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-100 flex items-center gap-2">
                    Suivi & Bilan des Pauses
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Suivi quotidien des pauses, alertes en direct et registre de l'équipe
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBreaksHistoryModal(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition cursor-pointer"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tab Switcher */}
            <div className="px-5 pt-2.5 border-b border-neutral-800 bg-neutral-900 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setModalTab("ALL_USERS");
                  loadAllUsersBreaks();
                }}
                className={`pb-2.5 px-1.5 text-xs font-bold transition flex items-center gap-2 border-b-2 cursor-pointer ${
                  modalTab === "ALL_USERS"
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Pauses Aujourd'hui (Tous les Utilisateurs)</span>
                {allUsersBreaksData?.kpis?.currentlyOnBreak ? (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800 animate-pulse">
                    {allUsersBreaksData.kpis.currentlyOnBreak} en pause
                  </span>
                ) : null}
              </button>

              <button
                type="button"
                onClick={() => {
                  setModalTab("MY_BREAKS");
                  loadBreaksHistory(historyDaysCount);
                }}
                className={`pb-2.5 px-1.5 text-xs font-bold transition flex items-center gap-2 border-b-2 cursor-pointer ${
                  modalTab === "MY_BREAKS"
                    ? "border-amber-500 text-amber-400"
                    : "border-transparent text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <History className="w-4 h-4" />
                <span>Mon Historique Personnel</span>
              </button>
            </div>

            {/* TAB 1: ALL USERS TODAY BREAKS */}
            {modalTab === "ALL_USERS" && (
              <div className="p-5 overflow-y-auto space-y-4 flex-1">
                {/* Top Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-500" />
                    <input
                      type="text"
                      value={allUsersSearch}
                      onChange={(e) => setAllUsersSearch(e.target.value)}
                      placeholder="Rechercher un collaborateur, poste..."
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={loadAllUsersBreaks}
                    disabled={isLoadingAllUsersBreaks}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-950 hover:bg-neutral-850 text-neutral-300 border border-neutral-800 text-xs font-semibold transition cursor-pointer self-start sm:self-auto"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAllUsersBreaks ? "animate-spin text-indigo-400" : ""}`} />
                    <span>Actualiser</span>
                  </button>
                </div>

                {isLoadingAllUsersBreaks ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-3 text-neutral-400">
                    <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                    <span className="text-xs font-medium">Chargement des pauses de l'équipe...</span>
                  </div>
                ) : (
                  <>
                    {/* KPI Summary Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800/80 space-y-1">
                        <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
                          En Poste Aujourd'hui
                        </span>
                        <div className="font-mono text-lg font-bold text-emerald-400">
                          {allUsersBreaksData?.kpis?.clockedInCount || 0} / {allUsersBreaksData?.kpis?.totalEmployees || 0}
                        </div>
                        <span className="text-[10px] text-neutral-500">Collaborateurs pointés</span>
                      </div>

                      <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800/80 space-y-1">
                        <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
                          En Pause Active
                        </span>
                        <div className="font-mono text-lg font-bold text-amber-400 flex items-center gap-1.5">
                          <span>{allUsersBreaksData?.kpis?.currentlyOnBreak || 0}</span>
                          {(allUsersBreaksData?.kpis?.currentlyOnBreak || 0) > 0 && (
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                          )}
                        </div>
                        <span className="text-[10px] text-neutral-500">En pause en ce moment</span>
                      </div>

                      <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800/80 space-y-1">
                        <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
                          Total Pauses Entreprise
                        </span>
                        <div className="font-mono text-lg font-bold text-indigo-400">
                          {formatHoursMins(allUsersBreaksData?.kpis?.totalCompanyBreakMinutes || 0)}
                        </div>
                        <span className="text-[10px] text-neutral-500">Cumulé aujourd'hui</span>
                      </div>

                      <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800/80 space-y-1">
                        <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
                          Dépassements &gt; 40m
                        </span>
                        <div
                          className={`font-mono text-lg font-bold ${
                            (allUsersBreaksData?.kpis?.exceededCount || 0) > 0
                              ? "text-rose-400"
                              : "text-emerald-400"
                          }`}
                        >
                          {allUsersBreaksData?.kpis?.exceededCount || 0}
                        </div>
                        <span className="text-[10px] text-neutral-500">
                          {(allUsersBreaksData?.kpis?.exceededCount || 0) === 0
                            ? "Tous quotas respectés 🎉"
                            : "Collaborateurs au-delà de 40m"}
                        </span>
                      </div>
                    </div>

                    {/* All Users List */}
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                        Statut des collaborateurs ({allUsersBreaksData?.breaks?.length || 0}) :
                      </div>

                      {allUsersBreaksData?.breaks && allUsersBreaksData.breaks.length > 0 ? (
                        <div className="space-y-2">
                          {allUsersBreaksData.breaks
                            .filter((b) => {
                              if (!allUsersSearch.trim()) return true;
                              const q = allUsersSearch.toLowerCase();
                              return (
                                b.firstName.toLowerCase().includes(q) ||
                                b.lastName.toLowerCase().includes(q) ||
                                b.position.toLowerCase().includes(q)
                              );
                            })
                            .map((b) => {
                              const isExp = expandedAllUserEmployeeId === b.employeeId;
                              return (
                                <div
                                  key={b.employeeId}
                                  className={`rounded-xl border transition-all ${
                                    b.isCritical
                                      ? "bg-rose-950/30 border-rose-800/70"
                                      : b.isOnBreak
                                      ? "bg-amber-950/25 border-amber-800/60"
                                      : b.isExceeded
                                      ? "bg-amber-950/15 border-amber-800/40"
                                      : "bg-neutral-950 border-neutral-800/80"
                                  }`}
                                >
                                  {/* Row Header */}
                                  <div
                                    onClick={() =>
                                      setExpandedAllUserEmployeeId(
                                        isExp ? null : b.employeeId
                                      )
                                    }
                                    className="p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 cursor-pointer select-none"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center font-bold text-xs text-neutral-200 shrink-0">
                                        {b.firstName[0]}
                                        {b.lastName[0]}
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-bold text-neutral-200">
                                            {b.firstName} {b.lastName}
                                          </span>
                                          {b.department && (
                                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">
                                              {b.department}
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[11px] text-neutral-400 mt-0.5">
                                          {b.position}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-3 sm:gap-4 justify-between sm:justify-end">
                                      {/* Live status badge */}
                                      <div>
                                        {b.isOnBreak ? (
                                          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-950 text-amber-300 border border-amber-800 animate-pulse flex items-center gap-1.5">
                                            <Coffee className="w-3.5 h-3.5 text-amber-400" />
                                            <span>
                                              En Pause ({b.currentBreakElapsedMinutes}m) •{" "}
                                              {b.currentBreakReason || "Standard"}
                                            </span>
                                          </span>
                                        ) : b.clockIn && !b.clockOut ? (
                                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
                                            🟢 Au poste
                                          </span>
                                        ) : b.clockOut ? (
                                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-900 text-neutral-400 border border-neutral-800">
                                            Sortie pointée
                                          </span>
                                        ) : (
                                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-900 text-neutral-500 border border-neutral-800">
                                            Non pointé
                                          </span>
                                        )}
                                      </div>

                                      {/* Total break time today */}
                                      <div className="text-right min-w-[90px]">
                                        <div className="font-mono text-xs font-bold text-neutral-200">
                                          {b.totalBreakMinutes} min / 40m
                                        </div>
                                        <div className="text-[10px]">
                                          {b.isExceeded ? (
                                            <span className="text-rose-400 font-semibold">
                                              ⚠️ +{b.totalBreakMinutes - 40}m
                                            </span>
                                          ) : b.totalBreakMinutes > 0 ? (
                                            <span className="text-emerald-400">
                                              {b.sessionsCount} pause(s)
                                            </span>
                                          ) : (
                                            <span className="text-neutral-500">0 pause</span>
                                          )}
                                        </div>
                                      </div>

                                      <div className="text-neutral-500">
                                        {isExp ? (
                                          <ChevronUp className="w-4 h-4" />
                                        ) : (
                                          <ChevronDown className="w-4 h-4" />
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Expanded break details */}
                                  {isExp && (
                                    <div className="px-4 pb-3 pt-1 border-t border-neutral-800/60 space-y-1.5 bg-neutral-950/40">
                                      {b.sessions && b.sessions.length > 0 ? (
                                        b.sessions.map((s, sIdx) => {
                                          const isLunch = s.reason
                                            .toLowerCase()
                                            .includes("déjeuner");
                                          const sessLimit = isLunch ? 45 : 15;
                                          const isOver = s.durationMinutes > sessLimit;

                                          return (
                                            <div
                                              key={s.id || sIdx}
                                              className="p-2 rounded-lg bg-neutral-900 border border-neutral-850 flex items-center justify-between text-xs"
                                            >
                                              <div className="flex items-center gap-2">
                                                <span className={s.isAutoDetected ? "text-indigo-400" : "text-amber-400"}>
                                                  {s.isAutoDetected ? "🤖" : "☕"}
                                                </span>
                                                <span className="font-medium text-neutral-200">
                                                  {s.reason}
                                                </span>
                                                {s.isAutoDetected && (
                                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/50">
                                                    Auto &gt;15m
                                                  </span>
                                                )}
                                                <span className="text-[11px] font-mono text-neutral-500">
                                                  ({formatTimeOnly(s.startTime)} →{" "}
                                                  {s.isOngoing
                                                    ? "En cours..."
                                                    : formatTimeOnly(s.endTime)}
                                                  )
                                                </span>
                                              </div>
                                              <div>
                                                <span
                                                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${
                                                    s.isOngoing
                                                      ? "bg-amber-950 text-amber-300 border border-amber-800 animate-pulse"
                                                      : isOver
                                                      ? "bg-amber-950 text-amber-300 border border-amber-800"
                                                      : "bg-emerald-950 text-emerald-400 border border-emerald-800/40"
                                                  }`}
                                                >
                                                  {s.durationMinutes} min{" "}
                                                  {s.isOngoing && "(En cours)"}
                                                  {isOver && !s.isOngoing && `(seuil ${sessLimit}m)`}
                                                </span>
                                              </div>
                                            </div>
                                          );
                                        })
                                      ) : (
                                        <div className="text-xs text-neutral-500 italic py-1">
                                          Aucune pause enregistrée pour ce collaborateur aujourd'hui.
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      ) : (
                        <div className="text-xs text-neutral-500 italic py-6 text-center">
                          Aucun collaborateur trouvé.
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* TAB 2: MY BREAKS HISTORY */}
            {modalTab === "MY_BREAKS" && (
              <>
                {/* Modal Subheader: Period Selectors */}
                <div className="px-5 py-3 border-b border-neutral-800/80 bg-neutral-900 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    {[7, 14, 30].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          setHistoryDaysCount(d);
                          loadBreaksHistory(d);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                          historyDaysCount === d
                            ? "bg-amber-600 text-neutral-950 shadow-sm"
                            : "bg-neutral-950 hover:bg-neutral-800 text-neutral-300 border border-neutral-800"
                        }`}
                      >
                        {d} derniers jours
                      </button>
                    ))}
                  </div>

                  <div className="text-xs text-neutral-400 flex items-center gap-2">
                    <span>Quota de référence :</span>
                    <span className="font-semibold text-neutral-200 px-2 py-0.5 rounded bg-neutral-950 border border-neutral-800">
                      40 min / jour
                    </span>
                  </div>
                </div>

                {/* Modal Body: KPIs & Day by Day List */}
                <div className="p-5 overflow-y-auto space-y-5 flex-1">
                  {isLoadingHistory ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-3 text-neutral-400">
                      <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
                      <span className="text-xs font-medium">Chargement de votre historique des pauses...</span>
                    </div>
                  ) : (
                    <>
                      {/* KPI Summary Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800/80 space-y-1">
                          <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
                            Total Cumulé
                          </span>
                          <div className="font-mono text-lg font-bold text-amber-400">
                            {formatHoursMins(breaksHistoryData?.stats.totalMinutesAll || 0)}
                          </div>
                          <span className="text-[10px] text-neutral-500">
                            Sur la période sélectionnée
                          </span>
                        </div>

                        <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800/80 space-y-1">
                          <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
                            Moyenne / Jour
                          </span>
                          <div className="font-mono text-lg font-bold text-neutral-200">
                            {breaksHistoryData?.stats.averageMinutesPerDay || 0} min
                          </div>
                          <span className="text-[10px] text-neutral-500">
                            Par jour avec pauses
                          </span>
                        </div>

                        <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800/80 space-y-1">
                          <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
                            Nombre de Pauses
                          </span>
                          <div className="font-mono text-lg font-bold text-indigo-400">
                            {breaksHistoryData?.stats.totalBreaksCount || 0}
                          </div>
                          <span className="text-[10px] text-neutral-500">
                            Sessions enregistrées
                          </span>
                        </div>

                        <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800/80 space-y-1">
                          <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
                            Dépassements &gt; 40m
                          </span>
                          <div
                            className={`font-mono text-lg font-bold ${
                              (breaksHistoryData?.stats.exceededDaysCount || 0) > 0
                                ? "text-rose-400"
                                : "text-emerald-400"
                            }`}
                          >
                            {breaksHistoryData?.stats.exceededDaysCount || 0} j
                          </div>
                          <span className="text-[10px] text-neutral-500">
                            {(breaksHistoryData?.stats.exceededDaysCount || 0) === 0
                              ? "Tous quotas respectés 🎉"
                              : "Jours avec dépassement"}
                          </span>
                        </div>
                      </div>

                      {/* Day by Day List */}
                      <div className="space-y-2">
                        <div className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                          Détail des journées ({breaksHistoryData?.history.length || 0}) :
                        </div>

                        {breaksHistoryData?.history && breaksHistoryData.history.length > 0 ? (
                          <div className="space-y-2">
                            {breaksHistoryData.history.map((day) => {
                              const isExp = expandedDay === day.date;
                              return (
                                <div
                                  key={day.date}
                                  className={`rounded-xl border transition-all ${
                                    day.isExceeded
                                      ? "bg-amber-950/20 border-amber-800/60"
                                      : "bg-neutral-950 border-neutral-800/80"
                                  }`}
                                >
                                  {/* Day Row Header */}
                                  <div
                                    onClick={() => setExpandedDay(isExp ? null : day.date)}
                                    className="p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div
                                        className={`w-2.5 h-2.5 rounded-full ${
                                          day.isExceeded
                                            ? "bg-rose-500"
                                            : day.totalMinutes > 0
                                            ? "bg-emerald-500"
                                            : "bg-neutral-600"
                                        }`}
                                      />
                                      <div>
                                        <div className="text-xs font-bold text-neutral-200 capitalize">
                                          {day.dayLabel}
                                        </div>
                                        <div className="text-[11px] text-neutral-400">
                                          {day.sessionsCount} pause(s) enregistrée(s)
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                      <div className="text-right">
                                        <div className="font-mono text-sm font-bold text-neutral-200">
                                          {formatHoursMins(day.totalMinutes)}
                                        </div>
                                        <div className="text-[10px]">
                                          {day.isExceeded ? (
                                            <span className="text-rose-400 font-semibold">
                                              ⚠️ Dépassement (+{day.totalMinutes - 40}m)
                                            </span>
                                          ) : (
                                            <span className="text-emerald-400 font-semibold">
                                              ✓ Quota respecté
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="text-neutral-500">
                                        {isExp ? (
                                          <ChevronUp className="w-4 h-4" />
                                        ) : (
                                          <ChevronDown className="w-4 h-4" />
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Expanded Sessions for Day */}
                                  {isExp && (
                                    <div className="px-4 pb-3 pt-1 border-t border-neutral-800/60 space-y-1.5 bg-neutral-950/40">
                                      {day.sessions && day.sessions.length > 0 ? (
                                        day.sessions.map((s, sIdx) => {
                                          const isLunch = s.reason.toLowerCase().includes("déjeuner");
                                          const sessLimit = isLunch ? 45 : 15;
                                          const sessOver = s.durationMinutes > sessLimit;

                                          return (
                                            <div
                                              key={s.id || sIdx}
                                              className="p-2 rounded-lg bg-neutral-900 border border-neutral-850 flex items-center justify-between text-xs"
                                            >
                                              <div className="flex items-center gap-2">
                                                <span className={s.isAutoDetected ? "text-indigo-400" : "text-amber-400"}>
                                                  {s.isAutoDetected ? "🤖" : "☕"}
                                                </span>
                                                <span className="font-medium text-neutral-200">
                                                  {s.reason}
                                                </span>
                                                {s.isAutoDetected && (
                                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/50">
                                                    Auto &gt;15m
                                                  </span>
                                                )}
                                                <span className="text-[11px] font-mono text-neutral-500">
                                                  ({formatTimeOnly(s.startTime)} →{" "}
                                                  {s.isOngoing ? "En cours..." : formatTimeOnly(s.endTime)})
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <span
                                                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${
                                                    sessOver
                                                      ? "bg-amber-950 text-amber-300 border border-amber-800"
                                                      : "bg-emerald-950 text-emerald-400 border border-emerald-800/40"
                                                  }`}
                                                >
                                                  {s.durationMinutes} min{" "}
                                                  {sessOver && `(seuil ${sessLimit}m)`}
                                                </span>
                                              </div>
                                            </div>
                                          );
                                        })
                                      ) : (
                                        <div className="text-xs text-neutral-500 italic py-1">
                                          Aucune session individuelle détaillée trouvée.
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-xs text-neutral-500 italic py-6 text-center">
                            Aucun historique de pause enregistré sur cette période.
                          </div>
                        )}
                      </div>

                      {/* Policy and Recommendations Notice */}
                      <div className="bg-neutral-950/80 border border-neutral-800 rounded-xl p-3.5 space-y-2 text-xs text-neutral-400">
                        <div className="font-bold text-neutral-300 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                          <Info className="w-3.5 h-3.5 text-indigo-400" />
                          Règles & Bonnes Pratiques de Repos BOOSTERA :
                        </div>
                        <ul className="list-disc list-inside space-y-1 text-[11px] text-neutral-400 pl-1">
                          <li>
                            <strong>Pause courte / Café :</strong> 15 minutes conseillées par session.
                          </li>
                          <li>
                            <strong>Pause Déjeuner :</strong> 45 minutes recommandées pour le repas.
                          </li>
                          <li>
                            <strong>Quota Quotidien :</strong> Ne pas dépasser 40 minutes de pause cumulée par jour de travail.
                          </li>
                          {!isCommercial && (
                            <li>
                              <strong>Pauses Automatiques (&gt; 15 min) :</strong> Toute inactivité supérieure à 15 minutes sans action au poste est automatiquement calculée et décomptée du quota journalier (40 min/jour).
                            </li>
                          )}
                          <li>
                            <strong>Alertes & Notifications :</strong> Des alertes visuelles et sonores vous informent dès qu'un seuil est dépassé afin de préserver votre temps de travail et la précision des fiches RH.
                          </li>
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-neutral-800 flex justify-end bg-neutral-950/70">
              <button
                type="button"
                onClick={() => setShowBreaksHistoryModal(false)}
                className="py-1.5 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
