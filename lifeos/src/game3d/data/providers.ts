/**
 * Data provider selection for the game layer. DEMO is the default everywhere; LIVE (read-only
 * LifeOS data) is used only when explicitly enabled by configuration AND a live provider exists.
 * No provider reads location or any data outside the LifeOS snapshot contract.
 */
import type { LifeOSReadAdapter } from "./lifeos";
import { MockLifeOSAdapter } from "./mock";

export type DataMode = "demo" | "live";

export function selectProvider(opts: { liveEnabled: boolean; live?: LifeOSReadAdapter | null }): LifeOSReadAdapter {
  if (opts.liveEnabled && opts.live && opts.live.kind === "lifeos") return opts.live;
  return new MockLifeOSAdapter();
}
