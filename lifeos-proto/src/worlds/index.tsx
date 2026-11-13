/** Built-in worlds: the reality layer (city), AETHERIA worlds, dev scenes. */
import { useEffect } from "react";
import { suspend } from "suspend-react";
import { registerWorld } from "./registry";
import { CityScene } from "../city/CityScene";
import { SPAWN } from "../city/layout";
import { selectProvider } from "../data/providers";
import { GameHud } from "../ui/GameHud";
import { Hud } from "../ui/Hud";
import { World } from "../world/World";
import { ActionButtons, Stick } from "../ui/Controls";
import { useProto, type Quality } from "../store";
import { LIVE_DATA } from "../config";
import { SanctuaryScene } from "../aetheria/scenes/sanctuary/SanctuaryScene";
import { SPAWN as SANCTUARY_SPAWN } from "../aetheria/scenes/sanctuary/layout";
import { AetheriaHud } from "../aetheria/ui/AetheriaHud";
import { KnowledgeScene } from "../aetheria/scenes/knowledge/KnowledgeScene";
import { SPAWN as KNOWLEDGE_SPAWN } from "../aetheria/scenes/knowledge/layout";
import { HealthScene } from "../aetheria/scenes/health/HealthScene";
import { SPAWN as HEALTH_SPAWN } from "../aetheria/scenes/health/layout";
import { MindScene } from "../aetheria/scenes/mind/MindScene";
import { SPAWN as MIND_SPAWN } from "../aetheria/scenes/mind/layout";

const provider = selectProvider({ liveEnabled: LIVE_DATA });

function CityWorldScene({ quality }: { quality: Quality }) {
  const snapshot = suspend(() => provider.load(), ["lifeos-snapshot", provider.kind]);
  const set = useProto((s) => s.set);
  useEffect(() => set({ snapshot }), [snapshot, set]);
  return <CityScene quality={quality} snapshot={snapshot} />;
}

function TestHud({ touch }: { touch: boolean }) {
  return (
    <>
      <Hud touch={touch} />
      {touch && (
        <>
          <Stick />
          <ActionButtons />
        </>
      )}
    </>
  );
}

let registered = false;
export function registerBuiltInWorlds() {
  if (registered) return;
  registered = true;
  registerWorld({ id: "city", title: "העיר (שכבת המציאות)", layer: "reality", light: "dusk", spawn: { x: SPAWN.x, y: 0, z: SPAWN.z, yaw: SPAWN.yaw }, wearsLoadout: false, Scene: CityWorldScene, Hud: GameHud });
  registerWorld({ id: "sanctuary", title: "AETHERIA · המקדש הראשון", layer: "aetheria", light: "celestial", spawn: SANCTUARY_SPAWN, wearsLoadout: true, Scene: SanctuaryScene, Hud: AetheriaHud });
  registerWorld({ id: "knowledge", title: "AETHERIA · ממלכת הידע", layer: "aetheria", light: "astral", spawn: KNOWLEDGE_SPAWN, wearsLoadout: true, Scene: KnowledgeScene, Hud: AetheriaHud });
  registerWorld({ id: "health", title: "AETHERIA · חורשת החיים", layer: "aetheria", light: "verdant", spawn: HEALTH_SPAWN, wearsLoadout: true, Scene: HealthScene, Hud: AetheriaHud });
  registerWorld({ id: "mind", title: "AETHERIA · היכל ההשתקפויות", layer: "aetheria", light: "dream", spawn: MIND_SPAWN, wearsLoadout: true, Scene: MindScene, Hud: AetheriaHud });
  registerWorld({ id: "test", title: "סצנת בדיקות פיזיקה", layer: "dev", light: "day", spawn: { x: 0, y: 0, z: 12, yaw: Math.PI }, wearsLoadout: false, Scene: World, Hud: TestHud });
}
