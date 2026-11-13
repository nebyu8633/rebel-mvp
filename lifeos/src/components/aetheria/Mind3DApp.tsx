"use client";
/**
 * AETHERIA — the Kingdom of the Mind (the Hall of Reflections) (engine + content synced from lifeos-proto into src/game3d).
 * Same local save as the Sanctuary; reached through the Gate of Dreams in the Living Grove.
 */
import { useEffect } from "react";
import { MindScene } from "@/game3d/aetheria/scenes/mind/MindScene";
import { SPAWN } from "@/game3d/aetheria/scenes/mind/layout";
import { AetheriaHud } from "@/game3d/aetheria/ui/AetheriaHud";
import { bindSaveOnHide, flushSave, useAetheria } from "@/game3d/aetheria/store";
import { useProto } from "@/game3d/store";
import { World3DHost } from "@/components/game3d-host/World3DHost";

export default function Mind3DApp() {
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
      scene={<MindScene quality={quality} />}
      hud={(touch) => <AetheriaHud touch={touch} />}
      light="dream"
      spawn={SPAWN}
      wearLoadout
      loadingText="AETHERIA · טוען את היכל ההשתקפויות…"
    />
  );
}
