/**
 * The Future Echo — first identity: The Silent Observer.
 * Its Shifting Presence here takes the player's own form (a clone of the current avatar, whatever
 * model that is) rendered as light. It watches, never speaks, and withdraws when approached:
 * fades out and reappears at another vantage point.
 */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { suspend } from "suspend-react";
import { resolveAvatar } from "../../../avatar/avatarSource";
import { gltfExtensions } from "../../../lib/loaders";
import { telemetry } from "../../../player/Player";

export interface Anchor {
  x: number;
  y: number;
  z: number;
}

const APPROACH_R = 3.2;

function echoMaterial(time: { value: number }) {
  const m = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x9fe3ff, emissiveIntensity: 1, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, roughness: 1 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time;
    sh.fragmentShader = `uniform float uTime;\n${sh.fragmentShader}`.replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
      float fres = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 2.0);
      float scan = 0.82 + 0.18 * sin(uTime * 2.6 + vViewPosition.y * 9.0);
      totalEmissiveRadiance *= (0.12 + 1.9 * fres) * scan;`,
    );
  };
  return m;
}

export function FutureEcho({ anchors, visible }: { anchors: Anchor[]; visible: boolean }) {
  const gl = useThree((s) => s.gl);
  const avatar = suspend(() => resolveAvatar(), ["avatar"]);
  const gltf = useGLTF(avatar.url, false, true, gltfExtensions(gl));
  const time = useMemo(() => ({ value: 0 }), []);
  const material = useMemo(() => echoMaterial(time), [time]);

  const rig = useMemo(() => {
    const scene = cloneSkinned(gltf.scene) as THREE.Object3D;
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.material = material;
        m.castShadow = false;
        m.receiveShadow = false;
        m.frustumCulled = false;
        m.renderOrder = 10;
      }
    });
    const mixer = new THREE.AnimationMixer(scene);
    const idle = gltf.animations.find((c) => c.name === "idle");
    return { scene, mixer, idle };
  }, [gltf, material]);
  // start in the effect (StrictMode mounts, unmounts and remounts effects)
  useEffect(() => {
    if (rig.idle) rig.mixer.clipAction(rig.idle).play();
    return () => void rig.mixer.stopAllAction();
  }, [rig]);

  // drifting motes around the presence
  const motes = useMemo(() => {
    const n = 140;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.25 + Math.random() * 0.55;
      pos.set([Math.cos(a) * r, Math.random() * 2, Math.sin(a) * r], i * 3);
      seed[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color: 0xbfeeff, size: 0.045, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
    return { g, m, seed };
  }, []);

  const group = useRef<THREE.Group>(null);
  const st = useRef({ anchor: 0, fade: 0, relocating: false, wait: 0 });
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    time.value += dt;
    rig.mixer.update(dt * 0.8);
    const g = group.current;
    if (!g) return;
    const s = st.current;
    const a = anchors[s.anchor % anchors.length];
    g.position.set(a.x, a.y, a.z);
    const dx = telemetry.x - a.x;
    const dz = telemetry.z - a.z;
    const near = Math.hypot(dx, dz) < APPROACH_R && Math.abs(telemetry.y - a.y) < 2.5;
    // silent observer: always faces the player, withdraws when approached
    const want = Math.atan2(dx, dz);
    let d = want - g.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    g.rotation.y += d * (1 - Math.exp(-3 * dt));
    if (visible && near && !s.relocating && anchors.length > 1) s.relocating = true;
    const target = visible && !s.relocating ? 1 : 0;
    s.fade += (target - s.fade) * (1 - Math.exp(-(target ? 1.6 : 4) * dt));
    if (s.relocating && s.fade < 0.02) {
      s.wait += dt;
      if (s.wait > 1.5) {
        // next anchor that is not near the player
        for (let k = 1; k <= anchors.length; k++) {
          const n = anchors[(s.anchor + k) % anchors.length];
          if (Math.hypot(telemetry.x - n.x, telemetry.z - n.z) > APPROACH_R * 1.8) {
            s.anchor = (s.anchor + k) % anchors.length;
            break;
          }
        }
        s.relocating = false;
        s.wait = 0;
      }
    }
    material.opacity = 0.6 * s.fade;
    motes.m.opacity = 0.8 * s.fade;
    g.visible = s.fade > 0.01;
    const p = motes.g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + dt * (0.15 + motes.seed[i] * 0.25);
      if (y > 2.1) y = 0;
      p.setY(i, y);
    }
    p.needsUpdate = true;
  });
  return (
    <group ref={group} userData={{ noBatch: true }}>
      <primitive object={rig.scene} />
      <points geometry={motes.g} material={motes.m} />
    </group>
  );
}
