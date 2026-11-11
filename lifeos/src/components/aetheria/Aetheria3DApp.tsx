"use client";
/**
 * AETHERIA — The First Sanctuary (engine + content synced from lifeos-proto into src/game3d).
 * Game state is saved locally on this device only (no backend, no LifeOS data is read or written).
 */
import { useEffect } from "react";
import { SanctuaryScene } from "@/game3d/aetheria/scenes/sanctuary/SanctuaryScene";
import { SPAWN } from "@/game3d/aetheria/scenes/sanctuary/layout";
import { AetheriaHud } from "@/game3d/aetheria/ui/AetheriaHud";
import { bindSaveOnHide, flushSave, useAetheria } from "@/game3d/aetheria/store";
import { useProto } from "@/game3d/store";
import { World3DHost } from "@/components/game3d-host/World3DHost";

export default function Aetheria3DApp() {
  const quality = useProto((s) => s.quality);
  useEffect(() => {
    void useAetheria.getState().hydrate();
    // iOS Safari: save on visibilitychange (hidden) as well as pagehide
    const unbind = bindSaveOnHide();
    return () => {
      void flushSave();
      unbind();
    };
  }, []);
  return (
    <World3DHost
      scene={<SanctuaryScene quality={quality} />}
      hud={(touch) => <AetheriaHud touch={touch} />}
      light="celestial"
      spawn={SPAWN}
      wearLoadout
      loadingText="AETHERIA · טוען את המקדש הראשון…"
    />
  );
}
