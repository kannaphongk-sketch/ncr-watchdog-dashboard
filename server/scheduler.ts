/**
 * Scheduler utilities for computing next run times in Asia/Bangkok timezone.
 * Uses Heartbeat (HTTP cron) via manus-heartbeat CLI — no in-process timers.
 */

export interface ScheduleInfo {
  jobName: string;
  label: string;
  cronUtc: string;
  nextRunBangkok: string;
  nextRunUtc: Date;
}

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7

/**
 * Convert a UTC date to Bangkok time string
 */
export function toBangkokTime(date: Date): string {
  return date.toLocaleString("en-GB", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/**
 * Get the next occurrence of a specific hour:minute in Bangkok time (UTC+7)
 */
function nextBangkokTime(hour: number, minute: number, dayOfWeek?: number, dayOfMonth?: number): Date {
  const now = new Date();
  // Current Bangkok time
  const bangkokNow = new Date(now.getTime() + BANGKOK_OFFSET_MS);

  let candidate = new Date(bangkokNow);
  candidate.setUTCHours(hour, minute, 0, 0);

  if (dayOfWeek !== undefined) {
    // Weekly: find next occurrence of the given day of week (0=Sunday)
    const currentDay = candidate.getUTCDay();
    let daysUntil = (dayOfWeek - currentDay + 7) % 7;
    if (daysUntil === 0 && bangkokNow.getTime() >= candidate.getTime()) {
      daysUntil = 7;
    }
    candidate.setUTCDate(candidate.getUTCDate() + daysUntil);
  } else if (dayOfMonth !== undefined) {
    // Monthly: find next occurrence of the given day of month
    candidate.setUTCDate(dayOfMonth);
    if (bangkokNow.getTime() >= candidate.getTime()) {
      // Move to next month
      candidate.setUTCMonth(candidate.getUTCMonth() + 1);
      candidate.setUTCDate(dayOfMonth);
    }
  } else {
    // Daily: if today's time has passed, move to tomorrow
    if (bangkokNow.getTime() >= candidate.getTime()) {
      candidate.setUTCDate(candidate.getUTCDate() + 1);
    }
  }

  // Convert back to UTC
  return new Date(candidate.getTime() - BANGKOK_OFFSET_MS);
}

/**
 * Get next run times for all 4 scheduled jobs
 */
export function getScheduleInfos(): ScheduleInfo[] {
  return [
    {
      jobName: "daily-morning",
      label: "Daily Morning (09:00 BKK)",
      cronUtc: "0 0 2 * * *", // 09:00 BKK = 02:00 UTC
      nextRunUtc: nextBangkokTime(9, 0),
      nextRunBangkok: toBangkokTime(nextBangkokTime(9, 0)),
    },
    {
      jobName: "daily-evening",
      label: "Daily Evening (18:00 BKK)",
      cronUtc: "0 0 11 * * *", // 18:00 BKK = 11:00 UTC
      nextRunUtc: nextBangkokTime(18, 0),
      nextRunBangkok: toBangkokTime(nextBangkokTime(18, 0)),
    },
    {
      jobName: "weekly-sunday",
      label: "Weekly (Sunday 09:00 BKK)",
      cronUtc: "0 0 2 * * 0", // Sunday 09:00 BKK = Sunday 02:00 UTC
      nextRunUtc: nextBangkokTime(9, 0, 0),
      nextRunBangkok: toBangkokTime(nextBangkokTime(9, 0, 0)),
    },
    {
      jobName: "monthly-first",
      label: "Monthly (1st 09:00 BKK)",
      cronUtc: "0 0 2 1 * *", // 1st of month 09:00 BKK = 02:00 UTC
      nextRunUtc: nextBangkokTime(9, 0, undefined, 1),
      nextRunBangkok: toBangkokTime(nextBangkokTime(9, 0, undefined, 1)),
    },
  ];
}

/**
 * Get current Bangkok time as a formatted string
 */
export function getCurrentBangkokTime(): string {
  return new Date().toLocaleString("en-GB", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
