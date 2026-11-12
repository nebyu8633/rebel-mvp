/**
 * Engine-level event channel. Worlds (city, AETHERIA scenes) emit generic reactions; the player
 * character responds. The engine never knows where an event came from (demo, LifeOS, narrative).
 */
export type PlayerReaction = "celebrate" | "acknowledge" | "surprise";
type Handler = (r: PlayerReaction) => void;

const handlers = new Set<Handler>();

export const playerReactions = {
  emit(r: PlayerReaction) {
    for (const h of handlers) h(r);
  },
  on(h: Handler): () => void {
    handlers.add(h);
    return () => void handlers.delete(h);
  },
};

/** World-level events from the player and the story (the Echo and other characters react to them). */
export type GameEvent = "wave" | "jump" | "resonance";
type GameHandler = (e: GameEvent) => void;
const gameHandlers = new Set<GameHandler>();
export const gameEvents = {
  emit(e: GameEvent) {
    for (const h of gameHandlers) h(e);
  },
  on(h: GameHandler): () => void {
    gameHandlers.add(h);
    return () => void gameHandlers.delete(h);
  },
};

/** Commands the world can give the player body (e.g. recover after a fall). Applied in the physics step. */
type TeleportHandler = (x: number, y: number, z: number, yaw?: number) => void;
let teleportHandler: TeleportHandler | null = null;
export const playerCommands = {
  teleport(x: number, y: number, z: number, yaw?: number) {
    teleportHandler?.(x, y, z, yaw);
  },
  /** registered by the Player component */
  bindTeleport(h: TeleportHandler): () => void {
    teleportHandler = h;
    return () => {
      if (teleportHandler === h) teleportHandler = null;
    };
  },
};
