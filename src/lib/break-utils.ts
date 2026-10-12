export interface BreakSessionItem {
  id: string;
  startTime: string;
  endTime: string | null;
  durationMinutes: number;
  reason: string;
  isOngoing: boolean;
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
