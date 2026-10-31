import { describe, expect, it } from "vitest";
import { addMonths, zonedToUtc, nowInZone, startOfWeek, formatDuration, diffMonths } from "../dates";

describe("dates", () => {
  it("addMonths clamps end of month", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-10-31", 12)).toBe("2027-10-31");
    expect(addMonths("2026-03-15", -3)).toBe("2025-12-15");
  });
  it("week starts on Sunday by default", () => {
    expect(startOfWeek("2026-11-05")).toBe("2026-11-01");
  });
  it("zonedToUtc handles Israel summer/winter time", () => {
    // IDT (UTC+3) before 2026-10-25, IST (UTC+2) after
    expect(zonedToUtc("2026-10-20", "09:00", "Asia/Jerusalem").toISOString()).toBe("2026-10-20T06:00:00.000Z");
    expect(zonedToUtc("2026-11-01", "09:00", "Asia/Jerusalem").toISOString()).toBe("2026-11-01T07:00:00.000Z");
  });
  it("zonedToUtc round-trips through nowInZone across a DST change", () => {
    for (const d of ["2026-03-26", "2026-03-27", "2026-10-24", "2026-10-25"]) {
      const inst = zonedToUtc(d, "08:30", "Asia/Jerusalem");
      expect(nowInZone("Asia/Jerusalem", inst)).toMatchObject({ date: d, time: "08:30" });
    }
  });
  it("spring-forward gap time resolves after the gap (New York 02:30)", () => {
    const inst = zonedToUtc("2026-03-08", "02:30", "America/New_York");
    expect(nowInZone("America/New_York", inst).time).toBe("03:30");
  });
  it("misc formatting", () => {
    expect(formatDuration(90)).toBe("שעה ו-30 דק׳");
    expect(diffMonths("2026-01-15", "2026-03-14")).toBe(1);
  });
});
