"use client";
/**
 * AETHERIA — the Kingdom of Career (the Great Works) (engine + content synced from lifeos-proto into src/game3d).
 * Same local save as the Sanctuary; reached through the Door of Works in the Hall of Reflections.
 */
import { useEffect } from "react";
import { CareerScene } from "@/game3d/aetheria/scenes/career/CareerScene";
import { SPAWN } from "@/game3d/aetheria/scenes/career/layout";
import { AetheriaHud } from "@/game3d/aetheria/ui/AetheriaHud";
import { bindSaveOnHide, flushSave, useAetheria } from "@/game3d/aetheria/store";
import { useProto } from "@/game3d/store";
import { World3DHost } from "@/components/game3d-host/World3DHost";

export default function Career3DApp() {
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
      scene={<CareerScene quality={quality} />}
      hud={(touch) => <AetheriaHud touch={touch} />}
      light="ember"
      spawn={SPAWN}
      wearLoadout
      loadingText="AETHERIA · טוען את בית המלאכה הגדול…"
    />
  );
}
