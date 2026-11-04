/**
 * Player: Rapier kinematic character controller (capsule) + follow camera.
 *
 * Separation of concerns:
 *   input -> intent (direction, magnitude)
 *   CharacterAnimationController -> pose + root motion + lockMovement
 *   this file -> velocity, gravity, collisions (Rapier KCC), facing, camera
 * The measured speed after collision (not the requested one) feeds the animation, so walking into a
 * wall slows the cycle down instead of sliding the feet.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CapsuleCollider, RigidBody, useAfterPhysicsStep, useBeforePhysicsStep, useRapier, type RapierRigidBody } from "@react-three/rapier";
import type { Collider, KinematicCharacterController } from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { Character, type CharacterHandle } from "../character/Character";
import { consumeEdges, input, readMove } from "./input";
import { interactables, params, useProto } from "../store";
import { autopilotStep } from "./autopilot";
import { characterEvents } from "../progression/useProgression";

export const CAPSULE = { halfHeight: 0.6, radius: 0.3 };
const FOOT = CAPSULE.halfHeight + CAPSULE.radius; // centre -> feet
const WALK = 1.35;
const RUN = 3.3;
const GRAVITY = 20;
const JUMP_V = 5.4;

/** ?cam=portrait: camera in front of the face (facial animation / skin shading review). */
const PORTRAIT = params.get("cam") === "portrait";
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt));

export interface PlayerTelemetry {
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  grounded: boolean;
  camYaw: number;
}
export const telemetry: PlayerTelemetry = { x: 0, y: 0, z: 0, yaw: 0, speed: 0, grounded: true, camYaw: 0 };

export function Player({ spawn = [0, 1, 12] as [number, number, number], spawnYaw = Math.PI }) {
  const body = useRef<RapierRigidBody>(null);
  const visual = useRef<THREE.Group>(null);
  const character = useRef<CharacterHandle>(null);
  const { world, rapier } = useRapier();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;

  const sim = useMemo(
    () => ({
      yaw: spawnYaw,
      vx: 0,
      vz: 0,
      vy: 0,
      speed: 0,
      grounded: true,
      kcc: null as KinematicCharacterController | null,
      collider: null as Collider | null,
      faceTarget: null as null | { x: number; z: number },
      nearest: null as null | string,
      cam: { yaw: spawnYaw + Math.PI, pitch: 0.18, dist: 4.4, idle: 0 },
      camPos: new THREE.Vector3(),
      camInit: false,
      groundRay: new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 }),
    }),
    [spawnYaw, rapier],
  );

  useEffect(() => {
    const kcc = world.createCharacterController(0.02);
    kcc.setUp({ x: 0, y: 1, z: 0 });
    kcc.setMaxSlopeClimbAngle((46 * Math.PI) / 180);
    kcc.setMinSlopeSlideAngle((50 * Math.PI) / 180);
    kcc.enableAutostep(0.32, 0.15, false);
    kcc.enableSnapToGround(0.35);
    kcc.setApplyImpulsesToDynamicBodies(true);
    kcc.setCharacterMass(75);
    sim.kcc = kcc;
    return () => {
      world.removeCharacterController(kcc);
      sim.kcc = null;
    };
  }, [world, sim]);

  // world reactions to (mock) verified LifeOS events: facial expression + a wave for milestones
  useEffect(() => {
    characterEvents.onReaction = (kind) => {
      if (kind === "revert") character.current?.setExpression("surprised", 1.5);
      else {
        character.current?.setExpression("happy", 3);
        if (kind === "celebrate") input.gesture = true;
      }
    };
    return () => {
      characterEvents.onReaction = null;
    };
  }, []);

  // dev-only hooks for automated tests (teleport + telemetry); stripped from production builds
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __protoPlayer?: unknown };
    w.__protoPlayer = {
      telemetry,
      anim: () => character.current?.controller.current,
      teleport: (x: number, y: number, z: number, yaw = sim.yaw) => {
        body.current?.setTranslation({ x, y: y + FOOT, z }, true);
        sim.yaw = yaw;
        sim.cam.yaw = yaw + Math.PI;
        sim.vx = sim.vz = sim.vy = 0;
        sim.camInit = false;
      },
    };
  }, [sim]);

  useBeforePhysicsStep(() => {
    const rb = body.current;
    const ch = character.current;
    if (!rb || !ch || !sim.kcc) return;
    const dt = Math.min(world.timestep || 1 / 60, 0.1);
    sim.collider ??= rb.collider(0);
    autopilotStep(dt);
    const mv = readMove();
    const edges = consumeEdges();

    // camera-relative intent -> world direction
    const cy = sim.cam.yaw;
    const fx = -Math.sin(cy);
    const fz = -Math.cos(cy);
    const rx = -fz;
    const rz = fx;
    let dx = rx * mv.x + fx * mv.y;
    let dz = rz * mv.x + fz * mv.y;
    const dl = Math.hypot(dx, dz);
    if (dl > 1e-4) {
      dx /= dl;
      dz /= dl;
    }
    const desiredYaw = dl > 1e-4 ? Math.atan2(dx, dz) : sim.yaw;

    // interaction target (nearest in range) — facing it is part of the interaction
    const p = rb.translation();
    let best: string | null = null;
    let bestD = Infinity;
    for (const it of interactables.values()) {
      const d = Math.hypot(it.x - p.x, it.z - p.z);
      if (d < it.radius && d < bestD && Math.abs(it.y - (p.y - FOOT)) < 1.5) {
        best = it.id;
        bestD = d;
      }
    }
    if (best !== sim.nearest) {
      sim.nearest = best;
      useProto.getState().set({ prompt: best ? interactables.get(best)!.label : null });
    }
    const wantInteract = edges.interact && !!best && sim.grounded;
    if (wantInteract) {
      const it = interactables.get(best!)!;
      sim.faceTarget = { x: it.x, z: it.z };
    }

    // ---- animation first: it decides whether movement is locked (turn / stop / interaction)
    const frame = ch.step(
      {
        dt,
        speed: sim.speed,
        inputMag: mv.mag,
        grounded: sim.grounded,
        vy: sim.vy,
        turnAngle: dl > 1e-4 ? wrap(desiredYaw - sim.yaw) : 0,
        interact: wantInteract,
        gesture: edges.gesture,
      },
      Math.max(0, (sim.speed - WALK) / (RUN - WALK)),
    );
    if (frame.events.includes("contact") && sim.nearest) interactables.get(sim.nearest)?.onContact();
    if (frame.events.some((e) => e.startsWith("state:"))) useProto.getState().set({ animState: frame.state });
    if (frame.state !== "interact") sim.faceTarget = null;

    // ---- horizontal motion
    let mx = 0;
    let mz = 0;
    if (frame.lockMovement) {
      sim.vx = sim.vz = 0;
      if (frame.root) {
        const c = Math.cos(sim.yaw);
        const s = Math.sin(sim.yaw);
        mx = frame.root.dx * c + frame.root.dz * s;
        mz = -frame.root.dx * s + frame.root.dz * c;
        sim.yaw = wrap(sim.yaw + frame.root.dyaw);
      }
      if (sim.faceTarget) sim.yaw = wrap(sim.yaw + wrap(Math.atan2(sim.faceTarget.x - p.x, sim.faceTarget.z - p.z) - sim.yaw) * (1 - Math.exp(-10 * dt)));
    } else {
      const target = mv.mag * (mv.run ? RUN : WALK);
      const tvx = dx * target;
      const tvz = dz * target;
      const accel = target > sim.speed ? 7 : 9;
      sim.vx = damp(sim.vx, tvx, accel, dt);
      sim.vz = damp(sim.vz, tvz, accel, dt);
      // turn toward the move direction; slower at speed for a natural arc
      const turnK = 10 - 4 * Math.min(1, sim.speed / RUN);
      if (dl > 1e-4) sim.yaw = wrap(sim.yaw + wrap(desiredYaw - sim.yaw) * (1 - Math.exp(-turnK * dt)));
      mx = sim.vx * dt;
      mz = sim.vz * dt;
    }

    // ---- vertical: gravity + jump
    if (edges.jump && sim.grounded && !frame.lockMovement) {
      sim.vy = JUMP_V;
      sim.grounded = false;
      // snap-to-ground would pull the take-off straight back down
      sim.kcc.disableSnapToGround();
    }
    sim.vy -= GRAVITY * dt;
    if (sim.grounded && sim.vy < -2) sim.vy = -2;

    sim.kcc.computeColliderMovement(sim.collider!, { x: mx, y: sim.vy * dt, z: mz }, rapier.QueryFilterFlags.EXCLUDE_SENSORS);
    const m = sim.kcc.computedMovement();
    const wasGrounded = sim.grounded;
    sim.grounded = sim.kcc.computedGrounded();
    if (sim.grounded && sim.vy < 0) sim.vy = -2;
    if (!sim.grounded && sim.vy > 0 && m.y < sim.vy * dt * 0.5) sim.vy = 0; // head bump
    if (!wasGrounded && sim.grounded) {
      sim.vy = -2;
      sim.kcc.enableSnapToGround(0.35);
    }
    const next = { x: p.x + m.x, y: p.y + m.y, z: p.z + m.z };
    // Rapier's KCC does not depenetrate: against curved colliders it can sink a few cm into the
    // floor. A downward ray from the capsule centre restores the feet onto the surface below.
    if (sim.vy <= 0) {
      sim.groundRay.origin = next;
      const hit = world.castRay(sim.groundRay, FOOT + 0.25, true, rapier.QueryFilterFlags.EXCLUDE_SENSORS, undefined, sim.collider!);
      if (hit) {
        const pen = FOOT - hit.timeOfImpact;
        if (pen > 0.04) next.y += pen - 0.01;
      }
    }
    rb.setNextKinematicTranslation(next);

    // measured speed (after collisions) drives the animation
    const measured = Math.hypot(m.x, m.z) / dt;
    sim.speed = damp(sim.speed, frame.lockMovement ? measured : Math.min(measured, Math.hypot(sim.vx, sim.vz) + 0.05), 18, dt);
    if (sim.speed < 0.02) sim.speed = 0;
  });

  useAfterPhysicsStep(() => {
    const rb = body.current;
    if (!rb || !visual.current) return;
    const p = rb.translation();
    visual.current.position.set(p.x, p.y - FOOT, p.z);
    visual.current.rotation.y = sim.yaw;
    Object.assign(telemetry, { x: p.x, y: p.y - FOOT, z: p.z, yaw: sim.yaw, speed: sim.speed, grounded: sim.grounded, camYaw: sim.cam.yaw });
  });

  // ---- follow camera (render loop): orbit by drag, gentle auto-align behind while moving, collision-aware
  const ray = useMemo(() => new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }), [rapier]);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const c = sim.cam;
    if (input.lookDX || input.lookDY) {
      c.yaw -= input.lookDX * 0.006;
      c.pitch = Math.max(-0.35, Math.min(0.9, c.pitch + input.lookDY * 0.004));
      input.lookDX = input.lookDY = 0;
      c.idle = 0;
    } else c.idle += dt;
    if (sim.speed > 0.5 && c.idle > 1.2) {
      const behind = sim.yaw + Math.PI;
      c.yaw += wrap(behind - c.yaw) * (1 - Math.exp(-0.9 * dt)) * Math.min(1, sim.speed / RUN + 0.3);
    }
    if (PORTRAIT) {
      c.yaw = sim.yaw;
      c.pitch = 0.05;
      c.dist = 0.85;
    }
    const tx = telemetry.x;
    const ty = telemetry.y + (PORTRAIT ? 1.66 : 1.55);
    const tz = telemetry.z;
    const dir = new THREE.Vector3(Math.sin(c.yaw) * Math.cos(c.pitch), Math.sin(c.pitch), Math.cos(c.yaw) * Math.cos(c.pitch));
    let dist = c.dist + (sim.speed > WALK + 0.3 && !PORTRAIT ? 0.5 : 0);
    ray.origin = { x: tx, y: ty, z: tz };
    ray.dir = { x: dir.x, y: dir.y, z: dir.z };
    const hit = world.castRay(ray, dist + 0.3, true, rapier.QueryFilterFlags.EXCLUDE_DYNAMIC | rapier.QueryFilterFlags.EXCLUDE_SENSORS, undefined, sim.collider ?? undefined);
    if (hit) dist = Math.max(0.6, Math.min(dist, hit.timeOfImpact - 0.25));
    const want = new THREE.Vector3(tx + dir.x * dist, ty + dir.y * dist, tz + dir.z * dist);
    if (!sim.camInit) {
      sim.camPos.copy(want);
      sim.camInit = true;
    }
    // pull in fast (avoid clipping), ease out slowly
    const k = want.distanceTo(new THREE.Vector3(tx, ty, tz)) < sim.camPos.distanceTo(new THREE.Vector3(tx, ty, tz)) ? 20 : 6;
    sim.camPos.lerp(want, 1 - Math.exp(-k * dt));
    camera.position.copy(sim.camPos);
    camera.lookAt(tx, ty - (PORTRAIT ? 0.02 : 0.1), tz);
  });

  return (
    <>
      <RigidBody ref={body} type="kinematicPosition" colliders={false} position={spawn} enabledRotations={[false, false, false]}>
        <CapsuleCollider args={[CAPSULE.halfHeight, CAPSULE.radius]} />
      </RigidBody>
      <group ref={visual}>
        <Character ref={character} />
      </group>
    </>
  );
}
