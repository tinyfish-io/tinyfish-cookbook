import { formatInTimeZone, getTimezoneOffset } from "date-fns-tz";

/**
 * Compute the next UTC Date at which a daily schedule should run.
 * System-timezone independent — uses only DST-aware offset lookups.
 */
export function computeNextRunAt(runTime: string, timezone: string): Date {
  if (!runTime || !/^\d{2}:\d{2}$/.test(runTime)) {
    throw new Error(`Invalid runTime format: "${runTime}". Expected "HH:MM".`);
  }

  const [hours, minutes] = runTime.split(":").map(Number);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`Invalid runTime: "${runTime}". Hours must be 0-23, minutes 0-59.`);
  }

  if (!timezone) {
    throw new Error(`Invalid timezone: "${timezone}"`);
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
  } catch {
    throw new Error(`Invalid timezone: "${timezone}"`);
  }

  const runTotalMins = hours * 60 + minutes;
  const now = new Date();
  const wallClockMs = (hours * 3600 + minutes * 60) * 1000;

  const nowDateStr = formatInTimeZone(now, timezone, "yyyy-MM-dd");
  const nowTimeStr = formatInTimeZone(now, timezone, "HH:mm");
  const [nowH, nowM] = nowTimeStr.split(":").map(Number);
  const nowTotalMins = nowH * 60 + nowM;

  let targetDateStr: string;
  if (runTotalMins > nowTotalMins) {
    targetDateStr = nowDateStr;
  } else {
    const nextDay = new Date(now.getTime() + 86400000);
    targetDateStr = formatInTimeZone(nextDay, timezone, "yyyy-MM-dd");
  }

  return utcForWallClock(targetDateStr, wallClockMs, timezone);
}

function utcForWallClock(dateStr: string, wallClockMs: number, timezone: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const midnightUtc = Date.UTC(y, m - 1, d);

  const midnightOffsetMs = getTimezoneOffset(timezone, new Date(midnightUtc));
  const initialUtcMs = midnightUtc + wallClockMs - midnightOffsetMs;

  const refinedOffsetMs = getTimezoneOffset(timezone, new Date(initialUtcMs));
  const finalUtcMs = midnightUtc + wallClockMs - refinedOffsetMs;

  return new Date(finalUtcMs);
}

export function getCommonTimezones(): Array<{ label: string; value: string }> {
  return [
    { label: "UTC (Coordinated Universal Time)", value: "UTC" },
    { label: "Honolulu (HST, UTC-10:00)", value: "Pacific/Honolulu" },
    { label: "Los Angeles (PST, UTC-8:00)", value: "America/Los_Angeles" },
    { label: "Denver (MST, UTC-7:00)", value: "America/Denver" },
    { label: "Chicago (CST, UTC-6:00)", value: "America/Chicago" },
    { label: "New York (EST, UTC-5:00)", value: "America/New_York" },
    { label: "São Paulo (BRT, UTC-3:00)", value: "America/Sao_Paulo" },
    { label: "London (BST, UTC+1:00)", value: "Europe/London" },
    { label: "Paris (CEST, UTC+2:00)", value: "Europe/Paris" },
    { label: "Frankfurt (CEST, UTC+2:00)", value: "Europe/Berlin" },
    { label: "Johannesburg (SAST, UTC+2:00)", value: "Africa/Johannesburg" },
    { label: "Dubai (GST, UTC+4:00)", value: "Asia/Dubai" },
    { label: "India (IST, UTC+5:30)", value: "Asia/Kolkata" },
    { label: "Bangkok (ICT, UTC+7:00)", value: "Asia/Bangkok" },
    { label: "Singapore (SGT, UTC+8:00)", value: "Asia/Singapore" },
    { label: "Shanghai (CST, UTC+8:00)", value: "Asia/Shanghai" },
    { label: "Tokyo (JST, UTC+9:00)", value: "Asia/Tokyo" },
    { label: "Seoul (KST, UTC+9:00)", value: "Asia/Seoul" },
    { label: "Sydney (AEST, UTC+10:00)", value: "Australia/Sydney" },
    { label: "Auckland (NZST, UTC+12:00)", value: "Pacific/Auckland" },
    { label: "Moscow (MSK, UTC+3:00)", value: "Europe/Moscow" },
  ];
}
