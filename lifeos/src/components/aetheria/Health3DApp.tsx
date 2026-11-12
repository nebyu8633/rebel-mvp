"use client";
/**
 * AETHERIA — the Kingdom of Health (the Living Grove) (engine + content synced from lifeos-proto into src/game3d).
 * Same local save as the Sanctuary; reached through the Gate of the Living in the Hall of Patterns.
 */
import { useEffect } from "react";
import { HealthScene } from "@/game3d/aetheria/scenes/health/HealthScene";
import { SPAWN } from "@/game3d/aetheria/scenes/health/layout";
import { AetheriaHud } from "@/game3d/aetheria/ui/AetheriaHud";
import { bindSaveOnHide, flushSave, useAetheria } from "@/game3d/aetheria/store";
import { useProto } from "@/game3d/store";
import { World3DHost } from "@/components/game3d-host/World3DHost";

export default function Health3DApp() {
  const quality = useProto((s) => s.quality);
  useEffect(() => {
    void useAetheria.getState().hydrate();
    const unbind = bindSaveOnHide();
    return () => {
      void flushSave();
      unbind();
    };
  }, []);
  return (
    <World3DHost
      scene={<HealthScene quality={quality} />}
      hud={(touch) => <AetheriaHud touch={touch} />}
      light="verdant"
      spawn={SPAWN}
      wearLoadout
      loadingText="AETHERIA · טוען את חורשת החיים…"
    />
  );
}
