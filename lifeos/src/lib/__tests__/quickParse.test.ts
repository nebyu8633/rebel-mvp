import { describe, expect, it } from "vitest";
import { parseQuick } from "../quickParse";

const T = "2026-11-15"; // Sunday
const p = (s: string) => parseQuick(s, T);

describe("quick capture parser", () => {
  it("title + tomorrow + explicit time", () => {
    const r = p("לקנות חלב מחר ב-18:00");
    expect(r).toMatchObject({ title: "לקנות חלב", date: "2026-11-16", time: "18:00", recurrence: null, ambiguities: [] });
  });
  it("weekday → the next such day; same weekday asks today or next week", () => {
    expect(p("להתקשר לבנק ביום שלישי")).toMatchObject({ title: "להתקשר לבנק", date: "2026-11-17", time: null });
    expect(p("ארוחה בשבת").date).toBe("2026-11-21");
    const same = p("פגישה ביום ראשון");
    expect(same.date).toBe(null);
    expect(same.ambiguities[0]).toMatchObject({ kind: "weekday", options: [{ value: T }, { value: "2026-11-22" }] });
  });
  it("an hour without a part of day is ambiguous — never guessed", () => {
    const r = p("לאסוף את הילדים ב-6");
    expect(r.time).toBe(null);
    expect(r.ambiguities[0]).toMatchObject({ kind: "time", options: [{ value: "06:00" }, { value: "18:00" }] });
    expect(r.title).toBe("לאסוף את הילדים");
  });
  it("part of day resolves the hour", () => {
    expect(p("ריצה מחר ב-6 בבוקר").time).toBe("06:00");
    expect(p("סרט ב-9 בערב").time).toBe("21:00");
    expect(p("פגישה ב-2 אחה״צ").time).toBe("14:00");
    expect(p("שיחה בשעה 14").time).toBe("14:00");
    expect(p("להתקשר לאמא הערב ב-8")).toMatchObject({ date: T, time: "20:00", title: "להתקשר לאמא" });
  });
  it("a part of day alone does not invent a time", () => {
    const r = p("לקרוא ספר בערב");
    expect(r.time).toBe(null);
    expect(r.title).toBe("לקרוא ספר בערב");
  });
  it("recurrence is a suggestion with a readable label", () => {
    const r = p("אימון כל יום שני ב-7 בבוקר");
    expect(r).toMatchObject({ title: "אימון", time: "07:00", date: "2026-11-16", recurrenceLabel: "כל יום שני" });
    expect(r.recurrence).toMatchObject({ freq: "weekly", byWeekday: [1], startDate: "2026-11-16" });
    expect(p("ויטמינים כל יום").recurrence).toMatchObject({ freq: "daily", startDate: T });
    expect(p("מים כל ערב ב-9").time).toBe("21:00");
  });
  it("explicit dates (rolls to next year only when the year wasn't written)", () => {
    expect(p("חידוש רישיון ב-20/11").date).toBe("2026-11-20");
    expect(p("ביטוח 3.1").date).toBe("2027-01-03");
    expect(p("משהו 31/02").date).toBe(null);
    expect(p("טופס 10/12/2027").date).toBe("2027-12-10");
  });
  it("priority and reminder intent are removed from the title", () => {
    expect(p("דחוף לשלם חשמל")).toMatchObject({ title: "לשלם חשמל", priority: "high" });
    expect(p("לשלם חשמל!")).toMatchObject({ title: "לשלם חשמל", priority: "high" });
    expect(p("תזכיר לי לשלם ארנונה מחר")).toMatchObject({ title: "לשלם ארנונה", wantsReminder: true, date: "2026-11-16" });
  });
  it("numbers that aren't times stay in the title", () => {
    expect(p("לקנות 6 ביצים")).toMatchObject({ title: "לקנות 6 ביצים", time: null, ambiguities: [] });
    expect(p("לקרוא פרק 12").time).toBe(null);
  });
  it("plain text is just a title", () => {
    expect(p("  לסדר את הארון  ")).toMatchObject({ title: "לסדר את הארון", date: null, time: null, priority: null });
  });
});
