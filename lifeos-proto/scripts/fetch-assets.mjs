// Downloads the Microsoft Rocketbox (MIT) source assets used by the prototype into assets-src/.
// Source: https://github.com/microsoft/Microsoft-Rocketbox (MIT, see assets-src/LICENSE.md)
import { mkdir, writeFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "assets-src");
const BASE = "https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/master/";
const AV = "Assets/Avatars/Adults/Male_Adult_01/";
const A = "Assets/Animations/all_animations_max_motextr_";
export const FILES = {
  "LICENSE.md": "LICENSE.md",
  "avatar/Male_Adult_01_facial.fbx": AV + "Export/Male_Adult_01_facial.fbx",
  ...Object.fromEntries(
    ["body_color", "body_normal", "body_specular", "head_color", "head_normal", "head_specular", "opacity_color"].map((t) => [`avatar/m002_${t}.tga`, `${AV}Textures/m002_${t}.tga`]),
  ),
  "anim/idle.fbx": A + "static/m_idle_neutral_01.max.fbx",
  "anim/interact.fbx": A + "static/m_try_door_outwards.max.fbx",
  "anim/wave.fbx": A + "static/m_wave_01.max.fbx",
  "anim/walk.fbx": A + "xy/m_walk_neutral_01.max.fbx",
  "anim/walk_start.fbx": A + "xy/m_walk_start.max.fbx",
  "anim/walk_stop.fbx": A + "xy/m_walk_stop.max.fbx",
  "anim/run.fbx": A + "xy/m_run_neutral_01.max.fbx",
  "anim/run_start.fbx": A + "xy/m_run_start.max.fbx",
  "anim/run_stop.fbx": A + "xy/m_run_stop.max.fbx",
  "anim/turn_left_90.fbx": A + "xyz/m_turn_left_90.max.fbx",
  "anim/turn_right_90.fbx": A + "xyz/m_turn_right_90.max.fbx",
};

for (const [out, src] of Object.entries(FILES)) {
  const dest = join(ROOT, out);
  try {
    if ((await stat(dest)).size > 0) continue;
  } catch {}
  const res = await fetch(BASE + src);
  if (!res.ok) throw new Error(`${src}: HTTP ${res.status}`);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  console.log("fetched", out);
}
