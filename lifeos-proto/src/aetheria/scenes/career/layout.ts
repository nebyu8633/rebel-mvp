/**
 * The Kingdom of Career — the Great Works. Metres. A wide iron-and-stone platform at the edge of a
 * chasm; the Tower of Works across it. North is -Z.
 */
export const SPAWN = { x: 0, y: 0, z: 22, yaw: Math.PI };
export const WORKS = { x: 0, z: 14, r: 15 }; // the main platform (walkable disc)
export const CHASM = { zEdge: WORKS.z - WORKS.r + 1, width: 18 };
export const TOWER = { x: 0, z: CHASM.zEdge - CHASM.width - 6, r: 6.5 };
/** the machine's face runs east of centre, leaving a wide way round its west end to the girder */
export const GEAR_WALL = { z: 4.6, x: 2.5, width: 13, sockets: [-0.5, 3, 6.5], y: 2.6 };
export const LEVER = { x: 8.5, z: 9 };
/** the girder's hinge, at the chasm's edge west of the machine */
export const CRANE = { x: -5, z: 1 };
export const BLUEPRINT = { x: TOWER.x, z: TOWER.z - 1 };
export const WAYSTONE = { x: 3, z: 25 };
export const FALL_Y = -12;
/** the crane's arm, swung across the chasm: a straight, level span from the platform to the tower */
export const SPAN = { from: [CRANE.x, 0, CRANE.z] as [number, number, number], to: [TOWER.x - 1.5, 0, TOWER.z + TOWER.r - 1] as [number, number, number] };

/** The Gate of the Hearth (to the Kingdom of Social): on the tower's platform once the blueprint is read. */
export const HEARTH_GATE = { x: TOWER.x + 3.6, z: TOWER.z + 2.6 };
/** coming back from the Village: in front of the gate, facing the girder home */
export const HEARTH_GATE_ARRIVAL = { x: TOWER.x + 1.6, y: 0.2, z: TOWER.z + 4.2, yaw: 0 };
