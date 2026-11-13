/**
 * The finale (end of the first chapter): back at the Origin Fragment with the sixth shard, CONNECTION
 * joins the six restored kingdoms. The engine validates it (origin_convergence needs all six); the
 * scene only shows it: six beams of the kingdoms' colours rise from the fragment into one crown.
 */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { interactables } from "../../../store";
import { telemetry } from "../../../player/Player";
import { playerReactions } from "../../../engine/events";
import { useAetheria } from "../../store";
import { useAetheriaUi } from "../../ui/uiStore";
import { FORCE_TITLES } from "../../core/model";
import { siteState } from "../../core/state";
import { JOURNAL } from "../../content";
import { SIGILS } from "../../content/firstResonance";
import { ORIGIN_SITE, W, WEALTH_SITES, onReturnToOrigin } from "../../content/wealthKingdom";
import { resonateSite } from "./SleepingGate";
import { FLOOR_Y, FRAGMENT, OBS, around, insideObservatory } from "./layout";

const RETURNED = "finale.returned";
const ease = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

export function Finale() {
  const hydrated = useAetheria((s) => s.hydrated);
  const hasShard = useAetheria((s) => s.world.flags.includes(W.shard));
  const returned = useAetheria((s) => s.world.flags.includes(RETURNED));
  const joined = useAetheria((s) => siteState(s.world, WEALTH_SITES[ORIGIN_SITE]) === "joined");
  const power = useAetheriaUi((s) => s.power);

  // stepping into the observatory with the sixth shard completes the "return" step
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.25 || !hydrated || !hasShard || returned) return;
    acc.current = 0;
    if (insideObservatory(telemetry.x, telemetry.z)) {
      if (useAetheria.getState().dispatch(onReturnToOrigin())) useAetheriaUi.getState().say("ששת הרסיסים רוטטים יחד. השבר מחכה לחיבור.");
    }
  });

  useEffect(() => {
    if (!returned || joined) return;
    const ip = around(180, 1.9);
    interactables.set("origin", {
      id: "origin",
      label: power ? `הפעילו ${FORCE_TITLES[power]}: שבר המקור` : "שבר המקור: בחרו כוח",
      x: ip.x,
      y: FLOOR_Y,
      z: ip.z,
      radius: 1.8,
      onContact: () => {
        const before = useAetheria.getState().world.journal.length;
        resonateSite(ORIGIN_SITE, { x: OBS.x, y: FRAGMENT.y, z: OBS.z });
        const st = useAetheria.getState();
        if (st.lastRejection === "resonance:not_ready") useAetheriaUi.getState().say("עוד ממלכה אחת לפחות לא שבה. השבר לא יתאחה חלקית.");
        for (const j of st.world.journal.slice(before)) {
          const text = JOURNAL[j.id];
          if (text) useAetheriaUi.getState().showCard({ title: text.title, body: text.body, tone: "resonance" });
        }
        if (siteState(st.world, WEALTH_SITES[ORIGIN_SITE]) === "joined") playerReactions.emit("celebrate");
      },
    });
    return () => void interactables.delete("origin");
  }, [returned, joined, power]);

  return <Crown on={joined} />;
}

/** six beams in the kingdoms' colours rising from the fragment and meeting in a crown of light */
function Crown({ on }: { on: boolean }) {
  const mats = useMemo(
    () => SIGILS.map((s) => new THREE.MeshBasicMaterial({ color: new THREE.Color(s.color).multiplyScalar(1.6), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })),
    [],
  );
  const halo = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color("#fff2d0").multiplyScalar(2), transparent: true, opacity: 0, depthWrite: false, toneMapped: false }), []);
  const group = useRef<THREE.Group>(null);
  const t = useRef(-1);
  useFrame(({ clock }, dt) => {
    if (t.current < 0) t.current = on ? 1 : 0;
    t.current = on ? Math.min(1, t.current + Math.min(dt, 0.1) / 4) : 0;
    const k = ease(t.current);
    mats.forEach((m, i) => (m.opacity = k * (0.55 + Math.sin(clock.elapsedTime * 1.6 + i) * 0.15)));
    halo.opacity = k * 0.8;
    if (group.current) {
      group.current.visible = k > 0.001;
      group.current.rotation.y += Math.min(dt, 0.1) * 0.25;
      group.current.scale.set(1, 0.05 + k * 0.95, 1);
    }
  });
  const beams = useMemo(() => {
    const len = 26; // each beam leans in so the six meet in a crown high above
    return SIGILS.map((_, i) => {
      const a = (i / SIGILS.length) * Math.PI * 2;
      const base = new THREE.Vector3(Math.cos(a) * 1.9, 0, Math.sin(a) * 1.9);
      const tip = new THREE.Vector3(Math.cos(a) * 0.3, len, Math.sin(a) * 0.3);
      const mid = base.clone().add(tip).multiplyScalar(0.5);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tip.clone().sub(base).normalize());
      return { mid, q, len: base.distanceTo(tip) };
    });
  }, []);
  return (
    <group ref={group} position={[OBS.x, FRAGMENT.y, OBS.z]} userData={{ noBatch: true }} visible={false}>
      {beams.map((b, i) => (
        <mesh key={i} material={mats[i]} position={b.mid} quaternion={b.q}>
          <cylinderGeometry args={[0.06, 0.22, b.len, 10, 1, true]} />
        </mesh>
      ))}
      <mesh material={halo} position={[0, 26, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[1.2, 0.12, 8, 48]} />
      </mesh>
    </group>
  );
}
