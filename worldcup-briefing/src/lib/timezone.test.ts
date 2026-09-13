import { describe, expect, it } from "vitest";
import { computeNextRunAt, getCommonTimezones } from "./timezone";

describe("computeNextRunAt", () => {
  it("returns a future date for a time that has not yet passed today", () => {
    const now = new Date();
    const result = computeNextRunAt("23:59", "UTC");
    expect(result.getTime()).toBeGreaterThan(now.getTime());
  });

  it("returns a future date for a time that has already passed today", () => {
    const result = computeNextRunAt("00:00", "UTC");
    const now = new Date();
    expect(result.getTime()).toBeGreaterThan(now.getTime());
  });

  it("always returns a future date for any valid timezone", () => {
    const now = new Date();
    for (const tz of getCommonTimezones()) {
      const result = computeNextRunAt("12:00", tz.value);
      expect(
        result.getTime(),
        `timezone ${tz.value} returned past date`,
      ).toBeGreaterThan(now.getTime());
    }
  });

  it("calling twice within the same minute returns the same date", () => {
    const a = computeNextRunAt("12:00", "Asia/Kolkata");
    const b = computeNextRunAt("12:00", "Asia/Kolkata");
    expect(a.getTime()).toBe(b.getTime());
  });

  it("returns different dates for different timezones at the same wall-clock time", () => {
    const kolkata = computeNextRunAt("09:00", "Asia/Kolkata");
    const newYork = computeNextRunAt("09:00", "America/New_York");
    expect(kolkata.getTime()).not.toBe(newYork.getTime());
  });

  it("throws for invalid runTime format", () => {
    expect(() => computeNextRunAt("9:00", "UTC")).toThrow("Invalid runTime format");
    expect(() => computeNextRunAt("", "UTC")).toThrow("Invalid runTime format");
    expect(() => computeNextRunAt("abc", "UTC")).toThrow("Invalid runTime format");
  });

  it("throws for out-of-range hours/minutes", () => {
    expect(() => computeNextRunAt("25:00", "UTC")).toThrow("Invalid runTime");
    expect(() => computeNextRunAt("12:60", "UTC")).toThrow("Invalid runTime");
    expect(() => computeNextRunAt("-1:00", "UTC")).toThrow("Invalid runTime format");
  });

  it("throws for invalid timezone", () => {
    expect(() => computeNextRunAt("12:00", "Mars/Olympus")).toThrow("Invalid timezone");
    expect(() => computeNextRunAt("12:00", "")).toThrow("Invalid timezone");
  });

  it("computes next run for Kolkata timezone", () => {
    const result = computeNextRunAt("09:00", "Asia/Kolkata");
    const now = new Date();
    expect(result.getTime()).toBeGreaterThan(now.getTime());
    expect(result).toBeInstanceOf(Date);
  });

  it("DST-aware: London timezone works year-round", () => {
    const result = computeNextRunAt("08:00", "Europe/London");
    const now = new Date();
    expect(result.getTime()).toBeGreaterThan(now.getTime());
    expect(result).toBeInstanceOf(Date);
  });

  it("works for all common timezones without throwing", () => {
    for (const tz of getCommonTimezones()) {
      expect(() => computeNextRunAt("06:00", tz.value), tz.value).not.toThrow();
      expect(() => computeNextRunAt("23:45", tz.value), tz.value).not.toThrow();
    }
  });
});

describe("getCommonTimezones", () => {
  it("returns at least 20 timezones", () => {
    expect(getCommonTimezones().length).toBeGreaterThanOrEqual(20);
  });

  it("each entry has label and value", () => {
    for (const tz of getCommonTimezones()) {
      expect(tz).toHaveProperty("label");
      expect(tz).toHaveProperty("value");
      expect(typeof tz.label).toBe("string");
      expect(typeof tz.value).toBe("string");
    }
  });

  it("includes major regions", () => {
    const values = getCommonTimezones().map((tz) => tz.value);
    expect(values).toContain("America/New_York");
    expect(values).toContain("Europe/London");
    expect(values).toContain("Europe/Paris");
    expect(values).toContain("Europe/Berlin");
    expect(values).toContain("Asia/Dubai");
    expect(values).toContain("Asia/Kolkata");
    expect(values).toContain("Asia/Singapore");
    expect(values).toContain("Asia/Tokyo");
    expect(values).toContain("Australia/Sydney");
    expect(values).toContain("America/Sao_Paulo");
  });
});
