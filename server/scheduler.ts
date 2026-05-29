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

function nextBangkokTime(hour: number, minute: number, dayOfWeek?: number, dayOfMonth?: number): Date {
  const now = new Date();
  const bangkokNow = new Date(now.getTime() + BANGKOK_OFFSET_MS);

  let candidate = new Date(bangkokNow);
  candidate.setUTCHours(hour, minute, 0, 0);

  if (dayOfWeek !== undefined) {
    const currentDay = candidate.getUTCDay();
    let daysUntil = (dayOfWeek - currentDay + 7) % 7;
    if (daysUntil === 0 && bangkokNow.getTime() >= candidate.getTime()) {
      daysUntil = 7;
    }
    candidate.setUTCDate(candidate.getUTCDate() + daysUntil);
  } else if (dayOfMonth !== undefined) {
    candidate.setUTCDate(dayOfMonth);
    if (bangkokNow.getTime() >= candidate.getTime()) {
      candidate.setUTCMonth(candidate.getUTCMonth() + 1);
      candidate.setUTCDate(dayOfMonth);
    }
  } else {
    if (bangkokNow.getTime() >= candidate.getTime()) {
      candidate.setUTCDate(candidate.getUTCDate() + 1);
    }
  }

  return new Date(candidate.getTime() - BANGKOK_OFFSET_MS);
}

export function getScheduleInfos(): ScheduleInfo[] {
  return [
    {
      jobName: "daily-morning",
      label: "Daily Morning (09:00 BKK)",
      cronUtc: "0 2 * * *",
      nextRunUtc: nextBangkokTime(9, 0),
      nextRunBangkok: toBangkokTime(nextBangkokTime(9, 0)),
    },
    {
      jobName: "daily-evening",
      label: "Daily Evening (18:00 BKK)",
      cronUtc: "0 11 * * *",
      nextRunUtc: nextBangkokTime(18, 0),
      nextRunBangkok: toBangkokTime(nextBangkokTime(18, 0)),
    },
    {
      jobName: "weekly-monday",
      label: "Weekly (Monday 09:00 BKK)",
      cronUtc: "0 2 * * 1",
      nextRunUtc: nextBangkokTime(9, 0, 1),
      nextRunBangkok: toBangkokTime(nextBangkokTime(9, 0, 1)),
    },
    {
      jobName: "monthly-first",
      label: "Monthly (1st 09:00 BKK)",
      cronUtc: "0 2 1 * *",
      nextRunUtc: nextBangkokTime(9, 0, undefined, 1),
      nextRunBangkok: toBangkokTime(nextBangkokTime(9, 0, undefined, 1)),
    },
  ];
}

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
