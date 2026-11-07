import type { CapacitorConfig } from "@capacitor/cli";

// Static, fully offline build (dist/) — assets, KTX2 transcoder and Rapier wasm are bundled.
const config: CapacitorConfig = {
  appId: "com.lifeos.proto3d",
  appName: "LifeOS Proto 3D",
  webDir: "dist",
  backgroundColor: "#0b0f14",
  android: { webContentsDebuggingEnabled: true },
  ios: { contentInset: "never", webContentsDebuggingEnabled: true },
};
export default config;
