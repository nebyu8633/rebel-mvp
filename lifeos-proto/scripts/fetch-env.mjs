// Environment PBR textures (CC0) + a CC0 street lamp model.
// Textures: Poly Haven / ambientCG via the Papyszoo/CC0-Public-Domain-Textures mirror (512px KTX2, UASTC, mipmapped).
// Lamp: Khronos glTF-Sample-Assets "Lantern" (CC0, Microsoft).
import { mkdir, writeFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "assets", "env");
const SRC = join(ROOT, "assets-src");
const MIRROR = "https://raw.githubusercontent.com/Papyszoo/CC0-Public-Domain-Textures/main/packs/";
const ph = (n) => ({ pack: "polyhaven", maps: { color: `polyhaven-textures/textures/${n}/${n}_albedo.ktx2`, normal: `polyhaven-textures/textures/${n}/${n}_normal.ktx2`, roughness: `polyhaven-textures/textures/${n}/${n}_roughness.ktx2`, ao: `polyhaven-textures/textures/${n}/${n}_ao.ktx2` } });
const acg = (n, extra = {}) => {
  const p = `ambientcg-textures/textures/${n}/${n}_1K-PNG_`;
  return { pack: "ambientcg", maps: { color: p + "Color.ktx2", normal: p + "NormalGL.ktx2", roughness: p + "Roughness.ktx2", ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, p + v])) } };
};
export const SETS = {
  plaza: { src: "cobblestone_square", ...ph("cobblestone_square") },
  street: { src: "asphalt_02", ...ph("asphalt_02") },
  sidewalk: { src: "concrete_pavement", ...ph("concrete_pavement") },
  plaster: { src: "beige_wall_001", ...ph("beige_wall_001") },
  brick: { src: "brick_wall_001", ...ph("brick_wall_001") },
  granite: { src: "granite_tile", ...ph("granite_tile") },
  wood: { src: "dark_wooden_planks", ...ph("dark_wooden_planks") },
  bark: { src: "bark_brown_02", ...ph("bark_brown_02") },
  grass: { src: "Grass004", ...acg("Grass004", { ao: "AmbientOcclusion.ktx2" }) },
  leaf: { src: "Leaf001", ...acg("Leaf001", { opacity: "Opacity.ktx2" }) },
  metal: { src: "PaintedMetal004", ...acg("PaintedMetal004", { metalness: "Metalness.ktx2" }) },
};

async function get(url, dest) {
  try {
    if ((await stat(dest)).size > 0) return false;
  } catch {}
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  return true;
}

const credits = [];
for (const [key, set] of Object.entries(SETS)) {
  for (const [map, path] of Object.entries(set.maps)) if (await get(MIRROR + path, join(OUT, key, `${map}.ktx2`))) console.log("fetched", key, map);
  credits.push(`- ${key}: ${set.pack === "polyhaven" ? "Poly Haven" : "ambientCG"} "${set.src}" — CC0 1.0`);
}
await get("https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Lantern/glTF-Binary/Lantern.glb", join(SRC, "env", "Lantern.glb"));
credits.push(`- lantern: Khronos glTF-Sample-Assets "Lantern" (© 2017 Microsoft) — CC0 1.0`);
await writeFile(join(OUT, "CREDITS.md"), `# Environment asset credits\n\nAll CC0 1.0 (public domain). Textures via the Papyszoo/CC0-Public-Domain-Textures mirror (512px KTX2).\n\n${credits.join("\n")}\n`);
