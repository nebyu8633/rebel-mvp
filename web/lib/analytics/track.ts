/**
 * Product analytics (spec §54).
 *
 * A thin abstraction rather than a vendor SDK: V1 only needs the event
 * vocabulary defined and called from the right places, so wiring an actual
 * provider later is one function body.
 *
 * Deliberately collects no personal information — no email, no business name,
 * no filenames, no invoice contents. Only counts and identifiers.
 */

export type AnalyticsEvent =
  | "page_view"
  | "start_analysis"
  | "upload_started"
  | "upload_completed"
  | "analysis_started"
  | "analysis_completed"
  | "results_viewed"
  | "signup_started"
  | "signup_completed"
  | "dashboard_viewed"
  | "invoice_deleted";

/** Non-identifying properties only: counts, durations, opaque ids, enums. */
export type AnalyticsProperties = Record<string, string | number | boolean>;

type Sink = (event: AnalyticsEvent, properties?: AnalyticsProperties) => void;

const sinks: Sink[] = [];

/** Registers a destination. Called once at startup when a provider is wired in. */
export function registerAnalyticsSink(sink: Sink): void {
  sinks.push(sink);
}

/**
 * Records an event.
 *
 * Never throws: a broken analytics call must not take a user flow down with
 * it, so sink failures are swallowed after being logged in development.
 */
export function track(event: AnalyticsEvent, properties?: AnalyticsProperties): void {
  for (const sink of sinks) {
    try {
      sink(event, properties);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn("analytics sink failed", error);
      }
    }
  }

  if (process.env.NODE_ENV === "development" && sinks.length === 0) {
    console.debug("[analytics]", event, properties ?? {});
  }
}
