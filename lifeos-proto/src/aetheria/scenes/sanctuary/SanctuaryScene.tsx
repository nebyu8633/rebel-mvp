/**
 * AETHERIA — The First Sanctuary: a misty plateau above the clouds with an abandoned observatory.
 * Gameplay: reach the observatory -> touch the Origin Fragment (the Future Echo appears as the
 * Silent Observer) -> align the three astrolabe rings (Form, Change, Connection) -> awaken the
 * Resonance (the dome opens, the broken stair reassembles: new colliders, a new path upward) ->
 * read the six kingdom sigils on the gallery.
 * All world changes go through the AETHERIA rules engine; the scene only renders state.
 */
import { useMemo } from "react";
import { rng } from "../../../world/geometry";
import { Batched } from "../../../world/Batched";
import { Tree } from "../../../world/Trees";
import { type Quality } from "../../../store";
import { useAetheria } from "../../store";
import { F } from "../../content/firstResonance";
import { CONSOLES, OBS, nearGate } from "./layout";
import { SleepingGate } from "./SleepingGate";
import { GateGuide } from "./GateGuide";
import { WorldDepth } from "./WorldDepth";
import { ResonanceFx } from "../../fx/ResonanceFx";
import { PostFx } from "../../../world/PostFx";
import { SoundController, DustMotes } from "./Life";
import { Terrain, Sky } from "./environment";
import { Ruins, Observatory, BrokenStair, Dome, Astrolabe, Console, SigilWall, MemoryShards, Waystone } from "./architecture";
import { Story, EchoController } from "./story";

export function SanctuaryScene({ quality }: { quality: Quality }) {
  const world = useAetheria((s) => s.world);
  const done = world.flags.includes(F.resonance);

  const trees = useMemo(() => {
    const r = rng(9);
    const out: { x: number; z: number; s: number }[] = [];
    while (out.length < 11) {
      const a = r() * Math.PI * 2;
      const d = 16 + r() * 19;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (Math.abs(x) < 7 && z > -2) continue;
      if (Math.hypot(x - OBS.x, z - OBS.z) < 12) continue;
      if (nearGate(x, z)) continue;
      out.push({ x, z, s: out.length + 50 });
    }
    return out;
  }, []);
  return (
    <group>
      <Batched>
        <Terrain />
        <Ruins />
        <Observatory done={done} />
        <Astrolabe />
        {CONSOLES.map((c) => (
          <Console key={c.force} {...c} />
        ))}
        <Waystone />
      </Batched>
      <Sky />
      <BrokenStair />
      <Dome />
      <SigilWall />
      <MemoryShards />
      <EchoController />
      <SleepingGate />
      <GateGuide />
      <WorldDepth />
      <ResonanceFx />
      <PostFx quality={quality} />
      <SoundController />
      <DustMotes count={quality === "low" ? 120 : 260} />
      {trees.map((t) => (
        <Tree key={t.s} x={t.x} z={t.z} seed={t.s} height={5.5 + (t.s % 3) * 1.2} shadows={quality !== "low"} />
      ))}
      <Story />
    </group>
  );
}
