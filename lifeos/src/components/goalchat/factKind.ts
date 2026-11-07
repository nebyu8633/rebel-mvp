import type { FactKind } from "@/lib/goalplan/schema";

export const FACT_KIND: Record<FactKind, { label: string; tone: "accent" | "amber" | "stone" | "indigo" }> = {
  confirmed: { label: "אושר", tone: "accent" },
  estimate: { label: "הערכה", tone: "amber" },
  assumption: { label: "הנחה", tone: "stone" },
  recommendation: { label: "המלצה", tone: "indigo" },
};
