"use client";
/**
 * AETHERIA — the Kingdom of Knowledge (engine + content synced from lifeos-proto into src/game3d).
 * Same local save as the Sanctuary; reached through the sealed threshold on the floating isle.
 */
import { useEffect } from "react";
import { KnowledgeScene } from "@/game3d/aetheria/scenes/knowledge/KnowledgeScene";
import { SPAWN } from "@/game3d/aetheria/scenes/knowledge/layout";
import { AetheriaHud } from "@/game3d/aetheria/ui/AetheriaHud";
import { bindSaveOnHide, flushSave, useAetheria } from "@/game3d/aetheria/store";
import { useProto } from "@/game3d/store";
import { World3DHost } from "@/components/game3d-host/World3DHost";

export default function Knowledge3DApp() {
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
      scene={<KnowledgeScene quality={quality} />}
      hud={(touch) => <AetheriaHud touch={touch} />}
      light="astral"
      spawn={SPAWN}
      wearLoadout
      loadingText="AETHERIA · טוען את ממלכת הידע…"
    />
  );
}
