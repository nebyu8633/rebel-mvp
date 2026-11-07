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
