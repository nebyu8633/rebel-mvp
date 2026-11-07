/** Arenas inspired by the six islands. Coordinates in meters; the arena is a rectangle w×h centered at 0. */
import type { ModeId, RegionId, Vec } from "./types";

export type Obstacle = { kind: "circle"; x: number; z: number; r: number; h: number } | { kind: "box"; x: number; z: number; w: number; d: number; h: number };
export interface FieldEffect {
  /** Neutral environmental area: heals or slows anyone inside. */
  kind: "spring" | "mist";
  x: number;
  z: number;
  r: number;
}
export interface PickupDef {
  kind: "heal" | "energy";
  x: number;
  z: number;
}
export interface MapDef {
  id: string;
  name: string;
  region: RegionId;
  w: number;
  h: number;
  palette: { ground: string; edge: string; obstacle: string; accent: string; sky: string; fog: string };
  obstacles: Obstacle[];
  fields: FieldEffect[];
  pickups: PickupDef[];
  /** Capture points for Capture the Crystal. */
  crystals: Vec[];
  desc: string;
}

const mirror = (o: Obstacle[]): Obstacle[] => [...o, ...o.map((x) => ({ ...x, x: -x.x, z: -x.z }))];

export const MAPS: MapDef[] = [
  {
    id: "vault",
    name: "כיכר הכספת",
    region: "wealth",
    w: 38,
    h: 26,
    palette: { ground: "#8a7a52", edge: "#5a4a2a", obstacle: "#d4a73c", accent: "#f6d77a", sky: "#2a2416", fog: "#3a3020" },
    obstacles: mirror([
      { kind: "box", x: -8, z: -5, w: 3, d: 3, h: 2.2 },
      { kind: "circle", x: -4, z: 6, r: 1.2, h: 3 },
      { kind: "box", x: -13, z: 4, w: 2, d: 6, h: 1.6 },
    ]).concat([{ kind: "circle", x: 0, z: 0, r: 1.6, h: 3.5 }]),
    fields: [],
    pickups: [
      { kind: "energy", x: 0, z: 9 },
      { kind: "energy", x: 0, z: -9 },
    ],
    crystals: [{ x: -11, z: -8 }, { x: 0, z: 6 }, { x: 11, z: -8 }],
    desc: "עמודי זהב ומחסות — מתאים למגינים.",
  },
  {
    id: "springs",
    name: "המעיינות",
    region: "health",
    w: 40,
    h: 28,
    palette: { ground: "#4f7a4a", edge: "#2e4a2c", obstacle: "#7a8a6a", accent: "#7fd3e6", sky: "#16261c", fog: "#1d3324" },
    obstacles: mirror([
      { kind: "circle", x: -9, z: -6, r: 1.6, h: 2 },
      { kind: "circle", x: -6, z: 7, r: 1.2, h: 2.4 },
      { kind: "box", x: -15, z: 0, w: 2.5, d: 5, h: 1.8 },
    ]),
    fields: [{ kind: "spring", x: 0, z: 0, r: 3.2 }],
    pickups: [
      { kind: "heal", x: 0, z: 10 },
      { kind: "heal", x: 0, z: -10 },
    ],
    crystals: [{ x: -12, z: 8 }, { x: 0, z: -7 }, { x: 12, z: 8 }],
    desc: "מעיין מרפא במרכז — שווה להילחם עליו.",
  },
  {
    id: "observatory",
    name: "המצפה",
    region: "knowledge",
    w: 36,
    h: 36,
    palette: { ground: "#4a5a72", edge: "#26344a", obstacle: "#c9d6ea", accent: "#a9c4ff", sky: "#0c1424", fog: "#121c30" },
    obstacles: ([0, 1, 2, 3, 4, 5].map((i) => ({ kind: "circle" as const, x: Math.cos((i * Math.PI) / 3) * 8, z: Math.sin((i * Math.PI) / 3) * 8, r: 1.3, h: 3 })) as Obstacle[]).concat(
      mirror([{ kind: "circle", x: -13, z: -13, r: 2, h: 2 }]),
      mirror([{ kind: "circle", x: 13, z: -13, r: 2, h: 2 }]),
    ),
    fields: [],
    pickups: [
      { kind: "energy", x: 0, z: 0 },
      { kind: "heal", x: -14, z: 0 },
      { kind: "heal", x: 14, z: 0 },
    ],
    crystals: [{ x: 0, z: -12 }, { x: 0, z: 0 }, { x: 0, z: 12 }],
    desc: "טבעת עמודים — זוויות ירי ארוכות.",
  },
  {
    id: "skyline",
    name: "רובע המגדלים",
    region: "career",
    w: 42,
    h: 28,
    palette: { ground: "#5c6470", edge: "#2f3540", obstacle: "#8fb8c9", accent: "#53b3c9", sky: "#121a22", fog: "#18222c" },
    obstacles: mirror([
      { kind: "box", x: -6, z: -4, w: 4, d: 2, h: 4 },
      { kind: "box", x: -12, z: 6, w: 3, d: 3, h: 5 },
      { kind: "box", x: -16, z: -6, w: 2, d: 4, h: 3 },
      { kind: "box", x: -3, z: 8, w: 2, d: 2, h: 3 },
    ]),
    fields: [],
    pickups: [
      { kind: "energy", x: 0, z: 0 },
      { kind: "heal", x: -9, z: 11 },
      { kind: "heal", x: 9, z: -11 },
    ],
    crystals: [{ x: -14, z: 0 }, { x: 0, z: 0 }, { x: 14, z: 0 }],
    desc: "רחובות ובניינים — מרחבי פינות ומארבים.",
  },
  {
    id: "temple",
    name: "חצר המקדש",
    region: "mind",
    w: 38,
    h: 30,
    palette: { ground: "#5e5a72", edge: "#2f2a44", obstacle: "#efe6d6", accent: "#9b7fd1", sky: "#140f22", fog: "#1d1630" },
    obstacles: mirror([
      { kind: "circle", x: -5, z: -5, r: 0.9, h: 3.4 },
      { kind: "circle", x: -5, z: 5, r: 0.9, h: 3.4 },
      { kind: "box", x: -13, z: 0, w: 2, d: 8, h: 2 },
    ]),
    fields: [
      { kind: "mist", x: -9, z: -10, r: 3.5 },
      { kind: "mist", x: 9, z: 10, r: 3.5 },
    ],
    pickups: [
      { kind: "energy", x: 0, z: 0 },
      { kind: "energy", x: 0, z: 12 },
    ],
    crystals: [{ x: -9, z: 9 }, { x: 0, z: 0 }, { x: 9, z: -9 }],
    desc: "ערפל מאט בפינות; עמודים במרכז.",
  },
];
export const MAP_BY_ID: Record<string, MapDef> = Object.fromEntries(MAPS.map((m) => [m.id, m]));

export interface ModeDef {
  id: ModeId;
  name: string;
  desc: string;
  /** Players needed to start (min) and the room size (max). */
  min: number;
  max: number;
  teams: "solo" | 2;
  timeLimit: number;
  /** Score to win (KOs or crystal points); null = elimination. */
  target: number | null;
  respawn: number | null;
  rules: string[];
  /** Hero XP for taking part / winning (separate from Life XP). */
  heroXp: { play: number; win: number };
}

export const MODES: ModeDef[] = [
  { id: "duel", name: "דו־קרב", desc: "1 נגד 1, שלושה גיבורים לכל צד.", min: 2, max: 2, teams: "solo", timeLimit: 180, target: null, respawn: null, rules: ["מנצח מי שמפיל את שלושת הגיבורים של היריב.", "בתום 3 דקות — מנצח מי שנשאר לו יותר חיים (באחוזים)."], heroXp: { play: 20, win: 15 } },
  { id: "ffa", name: "כולם נגד כולם", desc: "4–8 שחקנים, כל אחד לעצמו.", min: 4, max: 8, teams: "solo", timeLimit: 240, target: 12, respawn: 4, rules: ["נקודה על כל גיבור שמופל.", "כשכל שלושת הגיבורים נופלים — חוזרים אחרי 4 שניות.", "ראשון ל-12, או הכי הרבה בתום 4 דקות."], heroXp: { play: 20, win: 15 } },
  { id: "team2", name: "זירת צוותים 2×2", desc: "שני צוותים של שניים.", min: 4, max: 4, teams: 2, timeLimit: 240, target: 12, respawn: 5, rules: ["נקודה לצוות על כל גיבור יריב שמופל.", "חזרה אחרי 5 שניות.", "ראשון ל-12, או הכי הרבה בתום 4 דקות."], heroXp: { play: 20, win: 15 } },
  { id: "team3", name: "זירת צוותים 3×3", desc: "שני צוותים של שלושה.", min: 6, max: 6, teams: 2, timeLimit: 240, target: 18, respawn: 5, rules: ["נקודה לצוות על כל גיבור יריב שמופל.", "חזרה אחרי 5 שניות.", "ראשון ל-18, או הכי הרבה בתום 4 דקות."], heroXp: { play: 20, win: 15 } },
  { id: "crystal", name: "לכידת הקריסטל", desc: "צוותים נלחמים על שלושה קריסטלים.", min: 4, max: 6, teams: 2, timeLimit: 300, target: 100, respawn: 5, rules: ["עומדים ליד קריסטל כדי ללכוד אותו (לבד, בלי יריבים).", "כל קריסטל בשליטה נותן נקודה בשנייה.", "ראשון ל-100, או הכי הרבה בתום 5 דקות."], heroXp: { play: 25, win: 15 } },
];
export const MODE_BY_ID: Record<ModeId, ModeDef> = Object.fromEntries(MODES.map((m) => [m.id, m])) as Record<ModeId, ModeDef>;
