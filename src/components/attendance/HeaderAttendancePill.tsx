"use client";

import React, { useState, useEffect, useTransition } from "react";
import { LogIn, LogOut, CheckCircle2, Clock } from "lucide-react";
import {
  getMyAttendanceAction,
  clockInAction,
  clockOutAction,
} from "@/actions/attendance";

export function HeaderAttendancePill() {
  const [data, setData] = useState<{
    clockIn: string | null;
    clockOut: string | null;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadAttendance = async () => {
    try {
      const res = await getMyAttendanceAction();
      if (res?.today) {
        setData({
          clockIn: res.today.clockIn,
          clockOut: res.today.clockOut,
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
    const interval = setInterval(loadAttendance, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleClockIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      try {
        await clockInAction();
        await loadAttendance();
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
      } catch (err: any) {
        alert(err.message || "Erreur de pointage");
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
        className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-800/40 text-emerald-400 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
        title="Pointer mon arrivée maintenant"
      >
        <LogIn className="w-3.5 h-3.5" />
        <span>Pointer Arrivée</span>
      </button>
    );
  }

  if (data.clockIn && !data.clockOut) {
    return (
      <div className="hidden sm:inline-flex items-center gap-1.5 p-1 rounded-xl bg-neutral-900 border border-neutral-800 text-xs">
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-950/60 text-emerald-400 font-mono font-semibold text-[11px]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
          {formatTime(data.clockIn)}
        </span>
        <button
          type="button"
          onClick={handleClockOut}
          disabled={isPending}
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-[11px] transition shadow-xs cursor-pointer disabled:opacity-50"
          title="Pointer ma sortie en fin de journée"
        >
          <LogOut className="w-3 h-3" />
          <span>Pointer Sortie</span>
        </button>
      </div>
    );
  }

  return (
    <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 font-mono text-[11px]">
      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
      <span>
        {formatTime(data.clockIn)} - {formatTime(data.clockOut)}
      </span>
    </div>
  );
}
