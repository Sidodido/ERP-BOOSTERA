export interface BreakSessionItem {
  id: string;
  startTime: string;
  endTime: string | null;
  durationMinutes: number;
  reason: string;
  isOngoing: boolean;
  isAutoDetected?: boolean;
}

export interface DayBreakSummary {
  date: string;
  dayLabel: string;
  totalMinutes: number;
  sessionsCount: number;
  sessions: BreakSessionItem[];
  isExceeded: boolean;
}

export interface EmployeeTodayBreak {
  employeeId: string;
  userId?: string | null;
  firstName: string;
  lastName: string;
  position: string;
  department?: string | null;
  avatarUrl?: string | null;
  clockIn?: string | null;
  clockOut?: string | null;
  status: string;
  isOnBreak: boolean;
  currentBreakReason: string | null;
  currentBreakElapsedMinutes: number;
  currentBreakStartTime: string | null;
  totalBreakMinutes: number;
  sessionsCount: number;
  sessions: BreakSessionItem[];
  isExceeded: boolean;
  isCritical: boolean;
}

export function pairBreakLogs(
  logs: { id: string; action: string; createdAt: Date; details: string | null }[],
  now: Date = new Date()
): BreakSessionItem[] {
  const sessions: BreakSessionItem[] = [];
  let currentStart: { id: string; createdAt: Date; reason: string } | null = null;

  for (const log of logs) {
    let detailsObj: any = {};
    try {
      detailsObj = JSON.parse(log.details || "{}");
    } catch {}

    if (log.action === "PAUSE_START") {
      if (currentStart) {
        const dur = Math.max(
          1,
          Math.floor((log.createdAt.getTime() - currentStart.createdAt.getTime()) / 60000)
        );
        sessions.push({
          id: currentStart.id,
          startTime: currentStart.createdAt.toISOString(),
          endTime: log.createdAt.toISOString(),
          durationMinutes: dur,
          reason: currentStart.reason,
          isOngoing: false,
        });
      }
      currentStart = {
        id: log.id,
        createdAt: log.createdAt,
        reason: detailsObj.reason || "Pause standard",
      };
    } else if (log.action === "PAUSE_END") {
      if (currentStart) {
        const dur =
          detailsObj.durationMinutes ??
          Math.max(
            1,
            Math.floor((log.createdAt.getTime() - currentStart.createdAt.getTime()) / 60000)
          );
        sessions.push({
          id: log.id,
          startTime: currentStart.createdAt.toISOString(),
          endTime: log.createdAt.toISOString(),
          durationMinutes: dur,
          reason: detailsObj.reason || currentStart.reason,
          isOngoing: false,
        });
        currentStart = null;
      } else {
        const startIso = detailsObj.startTime
          ? new Date(detailsObj.startTime).toISOString()
          : log.createdAt.toISOString();
        sessions.push({
          id: log.id,
          startTime: startIso,
          endTime: log.createdAt.toISOString(),
          durationMinutes: detailsObj.durationMinutes || 0,
          reason: detailsObj.reason || "Pause standard",
          isOngoing: false,
        });
      }
    }
  }

  if (currentStart) {
    const dur = Math.max(
      0,
      Math.floor((now.getTime() - currentStart.createdAt.getTime()) / 60000)
    );
    sessions.push({
      id: currentStart.id,
      startTime: currentStart.createdAt.toISOString(),
      endTime: null,
      durationMinutes: dur,
      reason: currentStart.reason,
      isOngoing: true,
    });
  }

  return sessions;
}

/**
 * Détecte les périodes d'inactivité automatique (> thresholdMinutes, ex: 15 min)
 * entre actions consécutives ou inactivité actuelle au poste.
 */
export function detectAutoBreaks(params: {
  userId: string;
  clockIn: Date | string | null;
  clockOut: Date | string | null;
  activityLogs: { id: string; createdAt: Date | string }[];
  manualBreaks: BreakSessionItem[];
  now?: Date;
  thresholdMinutes?: number;
}): BreakSessionItem[] {
  if (!params.clockIn) return [];

  const now = params.now || new Date();
  const threshold = params.thresholdMinutes ?? 15;
  const clockInDate = new Date(params.clockIn);
  const clockOutDate = params.clockOut ? new Date(params.clockOut) : null;
  const workEnd = clockOutDate || now;

  // Filtrer les logs survenus après le pointage d'arrivée et avant la sortie/now
  const validLogs = params.activityLogs
    .map((l) => ({ id: l.id, date: new Date(l.createdAt) }))
    .filter(
      (l) =>
        l.date.getTime() >= clockInDate.getTime() && l.date.getTime() <= workEnd.getTime()
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  // Points de contrôle chronologiques : début à clockIn
  const points: { id: string; date: Date }[] = [{ id: "clock_in", date: clockInDate }];
  for (const l of validLogs) {
    const lastP = points[points.length - 1];
    if (l.date.getTime() - lastP.date.getTime() > 1000) {
      points.push(l);
    }
  }

  // Si sortie effectuée, ajouter clockOut comme dernier point
  if (clockOutDate && clockOutDate.getTime() > points[points.length - 1].date.getTime()) {
    points.push({ id: "clock_out", date: clockOutDate });
  }

  const autoSessions: BreakSessionItem[] = [];

  // 1. Analyse des intervalles entre actions successives
  for (let i = 0; i < points.length - 1; i++) {
    const gapStart = points[i].date;
    const gapEnd = points[i + 1].date;
    const gapMinutes = Math.floor((gapEnd.getTime() - gapStart.getTime()) / 60000);

    if (gapMinutes < threshold) continue;

    // Ne pas doubler si une pause manuelle couvre déjà cet intervalle
    const coveredByManual = params.manualBreaks.some((mb) => {
      const mStart = new Date(mb.startTime).getTime();
      const mEnd = mb.endTime ? new Date(mb.endTime).getTime() : now.getTime();
      return gapStart.getTime() < mEnd && gapEnd.getTime() > mStart;
    });

    if (coveredByManual) continue;

    autoSessions.push({
      id: `auto_${params.userId}_${gapStart.getTime()}_${gapEnd.getTime()}`,
      startTime: gapStart.toISOString(),
      endTime: gapEnd.toISOString(),
      durationMinutes: gapMinutes,
      reason: `Inactivité (${gapMinutes} min sans action)`,
      isOngoing: false,
      isAutoDetected: true,
    });
  }

  // 2. Détection d'inactivité en cours (collaborateur au poste sans action depuis > threshold)
  if (!clockOutDate) {
    const isManualOngoing = params.manualBreaks.some((mb) => mb.isOngoing);
    if (!isManualOngoing) {
      const lastPoint = points[points.length - 1];
      const timeSinceLastActionMin = Math.floor(
        (now.getTime() - lastPoint.date.getTime()) / 60000
      );

      if (timeSinceLastActionMin >= threshold) {
        const covered = params.manualBreaks.some((mb) => {
          const mStart = new Date(mb.startTime).getTime();
          const mEnd = mb.endTime ? new Date(mb.endTime).getTime() : now.getTime();
          return lastPoint.date.getTime() < mEnd && now.getTime() > mStart;
        });

        if (!covered) {
          autoSessions.push({
            id: `auto_ongoing_${params.userId}_${lastPoint.date.getTime()}`,
            startTime: lastPoint.date.toISOString(),
            endTime: null,
            durationMinutes: timeSinceLastActionMin,
            reason: `Inactivité en cours (${timeSinceLastActionMin} min sans action)`,
            isOngoing: true,
            isAutoDetected: true,
          });
        }
      }
    }
  }

  return autoSessions;
}

/**
 * Fusionne les pauses manuelles et automatiques par ordre chronologique
 */
export function mergeBreaksWithAuto(
  manualBreaks: BreakSessionItem[],
  autoBreaks: BreakSessionItem[]
): BreakSessionItem[] {
  const all = [...manualBreaks, ...autoBreaks];
  all.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  return all;
}

