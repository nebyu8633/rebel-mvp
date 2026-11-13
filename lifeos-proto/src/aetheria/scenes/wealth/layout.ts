/**
 * The Kingdom of Wealth — the Vault of Value. Metres; north is -Z. One great marble terrace (a hall
 * open to the sky) with the balance before the vault's round door.
 */
export const TERRACE = { x: 0, z: 6, r: 18 };
export const SPAWN = { x: 0, y: 0, z: 20, yaw: Math.PI };
export const WAYSTONE = { x: 3.2, z: 21 };
export const FALL_Y = -12;
export const VAULT = { x: 0, z: -9, doorR: 3.6, facadeW: 16, facadeH: 13 };
export const SCALE = { x: 0, z: 4, beam: 7, panR: 1.5 };
/** the pans: left holds the ancient weight, right receives the gold */
export const PANS = { left: { x: SCALE.x - SCALE.beam / 2, z: SCALE.z }, right: { x: SCALE.x + SCALE.beam / 2, z: SCALE.z } };
export const PLINTH_SPOTS = { west: { x: -10, z: 6 }, east: { x: 10, z: 6 }, south: { x: -5, z: 12 } };
export const SHARD = { x: VAULT.x, z: VAULT.z - 6.5 };
