/** Applies a pending arrival point for this world once the player body is ready. */
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { takeArrival, type ArrivalPoint } from "../engine/arrival";
import { playerCommands } from "../engine/events";

export function Arrival({ world }: { world: string }) {
  const at = useRef<ArrivalPoint | null | undefined>(undefined);
  const frames = useRef(0);
  useFrame(() => {
    if (at.current === undefined) at.current = takeArrival(world);
    if (!at.current) return;
    // wait a couple of frames: the player registers its teleport handler in an effect
    if (!playerCommands.isBound() || ++frames.current < 3) return;
    playerCommands.teleport(at.current.x, at.current.y, at.current.z, at.current.yaw);
    at.current = null;
  });
  return null;
}
