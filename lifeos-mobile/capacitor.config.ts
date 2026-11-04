import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Test shell: the app loads the DEPLOYED LifeOS site (LIFEOS_URL), so phones run exactly the
 * production build (same auth, same server routes). For store releases a richer native shell
 * will be needed (Apple guideline 4.2) — this is for device performance testing.
 */
const url = process.env.LIFEOS_URL;
if (!url) throw new Error("Set LIFEOS_URL to the deployed LifeOS URL, e.g. LIFEOS_URL=https://your-app.vercel.app npx cap sync");

const config: CapacitorConfig = {
  appId: "app.lifeos.test",
  appName: "LifeOS",
  webDir: "www",
  server: {
    url,
    cleartext: false,
    allowNavigation: [new URL(url).host],
  },
  ios: { contentInset: "always" },
  android: { allowMixedContent: false },
};

export default config;
