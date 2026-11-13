"use client";
/**
 * AETHERIA — the Kingdom of Social (the Village of the Hearth) (engine + content synced from lifeos-proto into src/game3d).
 * Same local save as the Sanctuary; reached through the Gate of the Hearth at the Tower of Works.
 */
import { useEffect } from "react";
import { SocialScene } from "@/game3d/aetheria/scenes/social/SocialScene";
import { SPAWN } from "@/game3d/aetheria/scenes/social/layout";
import { AetheriaHud } from "@/game3d/aetheria/ui/AetheriaHud";
import { bindSaveOnHide, flushSave, useAetheria } from "@/game3d/aetheria/store";
import { useProto } from "@/game3d/store";
import { World3DHost } from "@/components/game3d-host/World3DHost";

export default function Social3DApp() {
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
      scene={<SocialScene quality={quality} />}
      hud={(touch) => <AetheriaHud touch={touch} />}
      light="hearth"
      spawn={SPAWN}
      wearLoadout
      loadingText="AETHERIA · טוען את כפר האח…"
    />
  );
}
