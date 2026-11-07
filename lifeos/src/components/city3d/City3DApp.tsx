"use client";
/**
 * The LifeOS 3D city — the reality layer (engine synced from lifeos-proto into src/game3d).
 * Demo data by default; live (read-only) LifeOS data only when explicitly enabled at build time.
 * Nothing here writes tasks, goals or XP.
 */
import { useEffect, useMemo } from "react";
import { useStore } from "@/lib/store/store";
import { useToday } from "@/hooks/useToday";
import { CityScene } from "@/game3d/city/CityScene";
import { SPAWN } from "@/game3d/city/layout";
import { GameHud } from "@/game3d/ui/GameHud";
import { useProto } from "@/game3d/store";
import type { LifeOSSnapshot } from "@/game3d/data/lifeos";
import { mockSnapshot } from "@/game3d/data/mock";
import { LIVE_DATA } from "@/game3d/config";
import { buildSnapshot } from "./snapshot";
import { World3DHost } from "@/components/game3d-host/World3DHost";

export default function City3DApp() {
  // in demo mode the store is not read at all
  const db = useStore((s) => (LIVE_DATA ? s.db : null));
  const today = useToday();
  const snapshot: LifeOSSnapshot = useMemo(() => (LIVE_DATA && db ? buildSnapshot(db, today) : mockSnapshot()), [db, today]);
  const quality = useProto((s) => s.quality);
  useEffect(() => useProto.getState().set({ snapshot }), [snapshot]);
  return (
    <World3DHost
      scene={<CityScene quality={quality} snapshot={snapshot} />}
      hud={(touch) => <GameHud touch={touch} />}
      light="dusk"
      spawn={{ x: SPAWN.x, y: 0, z: SPAWN.z, yaw: SPAWN.yaw }}
      wearLoadout={false}
      loadingText="טוען את העיר…"
    />
  );
}
