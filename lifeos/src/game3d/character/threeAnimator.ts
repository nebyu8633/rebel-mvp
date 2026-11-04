/**
 * Adapter: applies CharacterAnimationController frames to a THREE.AnimationMixer and facial values
 * to morph targets. Actions never advance on their own (timeScale 0): the controller owns the clock,
 * so root motion, phase sync and crossfades stay consistent and testable.
 */
import * as THREE from "three";
import type { AnimFrame } from "./animationController";

export class ThreeAnimator {
  readonly mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private morphMeshes: THREE.Mesh[] = [];

  constructor(root: THREE.Object3D, clips: THREE.AnimationClip[]) {
    this.mixer = new THREE.AnimationMixer(root);
    for (const clip of clips) {
      const a = this.mixer.clipAction(clip);
      a.setLoop(THREE.LoopRepeat, Infinity);
      a.timeScale = 0;
      a.weight = 0;
      this.actions.set(clip.name, a);
    }
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.morphTargetDictionary && m.morphTargetInfluences) this.morphMeshes.push(m);
    });
  }

  clipNames() {
    return [...this.actions.keys()];
  }

  apply(frame: AnimFrame) {
    for (const [name, a] of this.actions) {
      const p = frame.clips[name];
      if (p) {
        a.weight = p.weight;
        a.time = p.time;
      } else a.weight = 0;
    }
    this.mixer.update(0);
  }

  applyMorphs(values: Record<string, number>) {
    for (const m of this.morphMeshes) {
      const dict = m.morphTargetDictionary!;
      const inf = m.morphTargetInfluences!;
      for (const k in dict) inf[dict[k]] = values[k] ?? 0;
    }
  }

  /** Effects-safe lifecycle (React StrictMode mounts/unmounts/remounts). */
  start() {
    for (const a of this.actions.values()) a.play();
  }
  stop() {
    this.mixer.stopAllAction();
  }
}
