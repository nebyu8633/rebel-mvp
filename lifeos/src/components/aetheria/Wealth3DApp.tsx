"use client";
/**
 * AETHERIA — the Kingdom of Wealth (the Vault of Value) (engine + content synced from lifeos-proto into src/game3d).
 * Same local save as the Sanctuary; reached through the Gate of Gold in the Village of the Hearth.
 */
import { useEffect } from "react";
import { WealthScene } from "@/game3d/aetheria/scenes/wealth/WealthScene";
import { SPAWN } from "@/game3d/aetheria/scenes/wealth/layout";
import { AetheriaHud } from "@/game3d/aetheria/ui/AetheriaHud";
import { bindSaveOnHide, flushSave, useAetheria } from "@/game3d/aetheria/store";
import { useProto } from "@/game3d/store";
import { World3DHost } from "@/components/game3d-host/World3DHost";

export default function Wealth3DApp() {
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
      scene={<WealthScene quality={quality} />}
      hud={(touch) => <AetheriaHud touch={touch} />}
      light="gilded"
      spawn={SPAWN}
      wearLoadout
      loadingText="AETHERIA · טוען את כספת הערך…"
    />
  );
}
