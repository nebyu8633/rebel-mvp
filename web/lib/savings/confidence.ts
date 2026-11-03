import type { ConfidenceBand } from "@/types/domain";

import { getDictionary } from "@/lib/i18n";

const dict = getDictionary();

const HIGH_THRESHOLD = 0.85;
const MEDIUM_THRESHOLD = 0.6;

/**
 * Buckets a raw confidence score into a band.
 *
 * The user sees a band, never the number: an exposed "0.87" invites reading
 * precision into a model's self-assessment that is not there, and the spec
 * bars showing internal confidence math (§28).
 */
export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= HIGH_THRESHOLD) return "high";
  if (confidence >= MEDIUM_THRESHOLD) return "medium";
  return "low";
}

export function confidenceLabel(confidence: number): string {
  return dict.confidence[confidenceBand(confidence)];
}

/** Average confidence across a set, for the analysis-level summary. */
export function averageConfidence(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
