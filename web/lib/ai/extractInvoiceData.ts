import "server-only";

import { getAiConfig } from "@/lib/config/env";

import { AnthropicExtractionProvider } from "./anthropic";
import {
  ExtractionError,
  type ExtractionInput,
  type InvoiceExtractionProvider,
} from "./provider";
import type { InvoiceExtraction } from "./schema";

let overrideProvider: InvoiceExtractionProvider | null = null;

/**
 * Replaces the provider, for tests and for Demo Mode.
 *
 * Pass `null` to restore the configured provider.
 */
export function setExtractionProvider(provider: InvoiceExtractionProvider | null): void {
  overrideProvider = provider;
}

function resolveProvider(): InvoiceExtractionProvider {
  if (overrideProvider !== null) return overrideProvider;

  const { provider } = getAiConfig();
  switch (provider) {
    case "anthropic":
      return new AnthropicExtractionProvider();
    default:
      throw new ExtractionError(
        "not_configured",
        `Unknown AI provider "${provider}". Set AI_PROVIDER to a supported value.`,
      );
  }
}

/**
 * Reads one invoice document into structured data.
 *
 * The single entry point the rest of the app uses; nothing outside this module
 * knows which vision provider is configured.
 */
export async function extractInvoiceData(
  input: ExtractionInput,
): Promise<InvoiceExtraction> {
  return resolveProvider().extract(input);
}
