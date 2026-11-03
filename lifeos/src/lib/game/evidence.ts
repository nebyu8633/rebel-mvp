import type { Task } from "../types";

export type EvidenceKind = Task["evidence"];

/**
 * Choose an appropriate proof type for a task from its wording (used by the planner when it
 * creates tasks; the user can always change it). Most tasks need no proof at all.
 */
export function inferEvidence(title: string): { evidence: EvidenceKind; criteria: string } {
  const t = title;
  if (/(אימון|להתאמן|ריצה|כושר|חדר כושר|הליכה)/.test(t)) return { evidence: "photo", criteria: "תמונה מהאימון (מקום/ציוד/מסך אפליקציה)" };
  if (/(לקנות|קניות|לרכוש|רכישת)/.test(t)) return { evidence: "photo", criteria: "תמונה של מה שנקנה" };
  if (/(לקרוא|קריאה|ספר)/.test(t)) return { evidence: "photo", criteria: "תמונה של הספר ושל העמוד שהגעת אליו" };
  if (/(קורס|תעודה|מבחן|בחינה)/.test(t)) return { evidence: "document", criteria: "צילום מסך של התוצאה או של אישור ההשלמה" };
  if (/(הפקדה|להפקיד|הוראת קבע|העברה)/.test(t)) return { evidence: "document", criteria: "אישור (אופציונלי) — יש להסתיר מספרי חשבון וסכומים רגישים" };
  if (/(שקילה|לשקול)/.test(t)) return { evidence: "manual", criteria: "רישום המשקל באפליקציה" };
  return { evidence: "none", criteria: "" };
}

export const EVIDENCE_LABEL: Record<EvidenceKind, string> = {
  none: "ללא הוכחה",
  photo: "תמונה",
  document: "מסמך / צילום מסך",
  manual: "אישור ידני",
};

export const EVIDENCE_STATUS_LABEL = {
  waiting: "ממתין להוכחה",
  submitted: "נשלח",
  review: "בבדיקה",
  accepted: "אושר",
  more: "נדרשת הוכחה נוספת",
  manual: "אושר ידנית",
} as const;

/** Evidence counts as verified only in these states. */
export const VERIFIED = new Set(["accepted", "manual"]);
