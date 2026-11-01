import type { GoalTurnInput, GoalTurnOutput } from "./ai-schema";

const digits = (s: string) => s.replace(/[^\d]/g, "");

/**
 * Guards against the model upgrading its own guesses to user facts:
 * a fact marked "confirmed" must be traceable to the user's own latest message
 * (for numbers: the digits appear in it); otherwise it is downgraded to "assumption".
 * Also bounds sizes and drops questions about keys that are already known.
 */
export function sanitizeTurn(out: GoalTurnOutput, input: GoalTurnInput): GoalTurnOutput {
  const msg = input.userMessage;
  const msgDigits = digits(msg);
  const factUpdates = out.factUpdates.slice(0, 20).map((f) => {
    if (f.kind !== "confirmed") return f;
    const traceable =
      f.valueType === "number"
        ? !!digits(f.value) && msgDigits.includes(digits(f.value))
        : f.valueType === "date"
          ? true // relative dates ("בתוך שנה") are computed by the model from the user's words; shown for confirmation
          : msg.includes(f.value) || msg.includes(f.display);
    return traceable ? f : { ...f, kind: "assumption" as const };
  });
  const known = new Set([...input.facts.map((f) => f.key), ...factUpdates.map((f) => f.key), ...input.skipped]);
  const question = out.question && !known.has(out.question.key) ? { ...out.question, options: out.question.options.slice(0, 12) } : null;
  return {
    ...out,
    reply: out.reply.slice(0, 3000),
    factUpdates,
    question,
    stage: Math.min(8, Math.max(1, Math.round(out.stage || 1))),
    readyForPlan: out.readyForPlan && !question,
    contradictions: out.contradictions.slice(0, 5),
    separateGoals: out.separateGoals.slice(0, 5),
  };
}
