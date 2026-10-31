import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { PlanProposal, type PlanInput } from "../planner/schema";
import { AIError, type AIContext, type AIProvider } from "./provider";

const DEFAULT_MODEL = "claude-opus-5-5";

const PLAN_SYSTEM = `You are the planning engine of LifeOS, a Hebrew personal life-management app.
Write ALL user-facing strings in natural Hebrew.

Rules:
- Break the goal into: milestones → monthly objectives → weekly objectives → concrete tasks.
- Detail tasks only for roughly the next 4–6 weeks; later milestones get 1–2 high-level tasks. Total tasks ≤ 40.
- Each task: a clear action starting with a verb, a realistic duration in minutes, a deadline (YYYY-MM-DD) between today and the goal's target date, a priority, a one-sentence rationale, and dependsOn keys when order matters.
- Respect the user's stated available time per week. If the plan cannot fit, say so in "warnings" — never hide overload.
- Separate strictly: "facts" (generally true, verifiable), "userProvided" (ONLY what the user entered — do not add anything), "assumptions" (anything you assumed), "recommendations".
- Never invent the user's schedule, finances, health status, or progress. If information is missing, add a task to collect it and list it in warnings.
- Finance: never guarantee returns; any return figure must be labelled as an assumption. Investment target is market value, not deposits. Motorcycle savings are separate from investments. The app does not execute trades.
- Health/weight: gradual and sustainable; no extreme diets, no calorie prescriptions, no guarantees; recommend a qualified professional when relevant.
- Weeks start on Sunday. Months are given as the first day of the month.`;

const ASK_SYSTEM = `You are the assistant inside LifeOS, a Hebrew personal life-management app.
Answer in concise, warm, practical Hebrew (max ~180 words, short bullet lists are fine).
Only use the data in the provided JSON snapshot of the user's own account. If something is not in the data, say you don't know rather than guessing.
Never fabricate progress, finances, schedule or health information. Never guarantee investment returns or weight outcomes.
When reorganizing missed tasks, propose a realistic spread over the coming days within the user's availability — not everything tomorrow — and note that the "תוכנית התאוששות" button in the app can apply it.
When asked for a grocery list, base it only on the approved meal plan in the snapshot and mention the app can generate the checklist automatically.`;

function mapError(e: unknown): AIError {
  if (e instanceof Anthropic.RateLimitError) {
    const ra = Number(e.headers?.get?.("retry-after") ?? "") || undefined;
    return new AIError("rate_limited", "שירות ה-AI עמוס כרגע (מגבלת קצב). נסו שוב בעוד רגע.", ra);
  }
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError)
    return new AIError("auth", "מפתח ה-API של Anthropic אינו תקין או חסרות לו הרשאות.");
  if (e instanceof Anthropic.BadRequestError) return new AIError("bad_request", "הבקשה לשירות ה-AI נדחתה (בקשה לא תקינה).");
  if (e instanceof Anthropic.APIConnectionError) return new AIError("unavailable", "אין חיבור לשירות ה-AI.");
  if (e instanceof Anthropic.APIError) return new AIError("unavailable", `שגיאה בשירות ה-AI (${e.status ?? "?"}).`);
  if (e instanceof AIError) return e;
  return new AIError("unavailable", "שגיאה לא צפויה בשירות ה-AI.");
}

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model?: string, clientOptions: Omit<NonNullable<ConstructorParameters<typeof Anthropic>[0]>, "apiKey"> = {}) {
    this.client = new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000, ...clientOptions });
    this.model = model || DEFAULT_MODEL;
  }

  async plan(input: PlanInput, today: string) {
    const { previous, regenerateMilestoneKey, ...rest } = input;
    const userContent = JSON.stringify({
      today,
      goal: rest,
      ...(regenerateMilestoneKey && previous
        ? {
            instruction: `Regenerate ONLY the milestone with key "${regenerateMilestoneKey}". Return the full plan, keeping every other milestone exactly as in previous_plan.`,
            previous_plan: previous,
          }
        : {}),
    });
    try {
      const res = await this.client.beta.messages.parse({
        model: this.model,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        thinking: { type: "adaptive" },
        output_config: { effort: "medium", format: betaZodOutputFormat(PlanProposal) },
        system: PLAN_SYSTEM,
        messages: [{ role: "user", content: userContent }],
      });
      if (res.stop_reason === "refusal") throw new AIError("refused", "שירות ה-AI סירב לבקשה. אפשר להשתמש בתכנון הבסיסי.");
      if (res.stop_reason === "max_tokens") throw new AIError("invalid_output", "תשובת ה-AI נקטעה. נסו מטרה מצומצמת יותר.");
      if (!res.parsed_output) throw new AIError("invalid_output", "שירות ה-AI החזיר תוכנית במבנה לא תקין.");
      return res.parsed_output;
    } catch (e) {
      throw mapError(e);
    }
  }

  async ask(question: string, context: AIContext) {
    try {
      const res = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: 4000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        thinking: { type: "adaptive" },
        output_config: { effort: "low" },
        system: ASK_SYSTEM,
        messages: [
          {
            role: "user",
            content: `<user_data>\n${JSON.stringify(context)}\n</user_data>\n\nשאלה: ${question}`,
          },
        ],
      });
      if (res.stop_reason === "refusal") throw new AIError("refused", "שירות ה-AI סירב לשאלה.");
      const text = res.content
        .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      if (!text) throw new AIError("invalid_output", "שירות ה-AI החזיר תשובה ריקה.");
      return text;
    } catch (e) {
      throw mapError(e);
    }
  }
}

export function getProvider(): AIProvider | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  return new AnthropicProvider(key, process.env.ANTHROPIC_MODEL);
}
