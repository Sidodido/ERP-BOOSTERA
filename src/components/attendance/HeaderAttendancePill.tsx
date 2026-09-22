"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogIn, LogOut, CheckCircle2, Clock, Coffee, Play } from "lucide-react";
import {
  getMyAttendanceAction,
  clockInAction,
  clockOutAction,
  endBreakAction,
} from "@/actions/attendance";

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

export function HeaderAttendancePill() {
  const router = useRouter();
  const [data, setData] = useState<{
    clockIn: string | null;
    clockOut: string | null;
    isOnBreak: boolean;
    elapsedMinutes: number;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadAttendance = async () => {
    try {
      const res = await getMyAttendanceAction();
      if (res?.today) {
        setData({
          clockIn: res.today.clockIn,
          clockOut: res.today.clockOut,
          isOnBreak: !!res.activeBreak?.isOnBreak,
          elapsedMinutes: res.activeBreak?.elapsedMinutes || 0,
        });
      } else {
        setData(null);
      }
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    loadAttendance();
    const interval = setInterval(loadAttendance, 15000);

    const handleSync = () => loadAttendance();
    window.addEventListener("crm:attendance-updated", handleSync);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("crm_attendance_sync");
      bc.onmessage = handleSync;
    } catch {}

    return () => {
      clearInterval(interval);
      window.removeEventListener("crm:attendance-updated", handleSync);
      if (bc) bc.close();
    };
  }, []);

  const handleClockIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      try {
        await clockInAction();
        await loadAttendance();
        broadcastAttendanceSync();
        router.refresh();
      } catch (err: any) {
        alert(err.message || "Erreur de pointage");
      }
    });
  };

  const handleClockOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      try {
        await clockOutAction();
        await loadAttendance();
        broadcastAttendanceSync();
        router.refresh();
      } catch (err: any) {
        alert(err.message || "Erreur de pointage");
      }
    });
  };

  const handleEndBreak = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      try {
        await endBreakAction();
        await loadAttendance();
        broadcastAttendanceSync();
        router.refresh();
      } catch (err: any) {
        alert(err.message || "Erreur de fin de pause");
      }
    });
  };

  const formatTime = (iso?: string | null) => {
    if (!iso) return "";
    return new Date(iso).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!data || (!data.clockIn && !data.clockOut)) {
    return (
      <button
        type="button"
        onClick={handleClockIn}
        disabled={isPending}
        className="attendance-header-container hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-800/40 text-emerald-400 text-xs font-semibold transition cursor-pointer disabled:opacity-50 shadow-xs"
        title="Pointer mon arrivée maintenant"
      >
        <LogIn className="w-3.5 h-3.5" />
        <span>Pointer Arrivée</span>
      </button>
    );
  }

  if (data.clockIn && !data.clockOut) {
    if (data.isOnBreak) {
      return (
        <div className="attendance-header-container hidden sm:inline-flex items-center gap-1.5 p-1 rounded-xl bg-neutral-900 border border-amber-800/60 text-xs shadow-xs">
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-950/70 text-amber-300 font-medium text-[11px] animate-pulse">
            <Coffee className="w-3 h-3 text-amber-400" />
            <span>Pause ({data.elapsedMinutes}m)</span>
          </span>
          <button
            type="button"
            onClick={handleEndBreak}
            disabled={isPending}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] transition shadow-xs cursor-pointer disabled:opacity-50"
            title="Reprendre le travail"
          >
            <Play className="w-2.5 h-2.5 fill-white" />
            <span>Reprendre</span>
          </button>
        </div>
      );
    }

    return (
      <div className="attendance-header-container hidden sm:inline-flex items-center gap-1.5 p-1 rounded-xl bg-neutral-900 border border-neutral-800 text-xs shadow-xs">
        <span className="attendance-time-pill flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-950/60 text-emerald-400 font-mono font-semibold text-[11px] border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
          {formatTime(data.clockIn)}
        </span>
        <button
          type="button"
          onClick={handleClockOut}
          disabled={isPending}
          className="attendance-checkout-btn inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] transition shadow-xs cursor-pointer disabled:opacity-50"
          title="Pointer ma sortie en fin de journée"
        >
          <LogOut className="w-3 h-3" />
          <span>Pointer Sortie</span>
        </button>
      </div>
    );
  }

  return (
    <div className="attendance-header-container hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 font-mono text-[11px] shadow-xs">
      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
      <span>
        {formatTime(data.clockIn)} - {formatTime(data.clockOut)}
      </span>
    </div>
  );
}
