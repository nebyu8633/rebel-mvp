# AETHERIA: The Fractured Creation
## Technical audit, visual assessment, visual bible and development plan

Date: 2026-11-10. Branch: `lifeos-app`. Baseline for rollback: tag `aetheria-baseline-2026-11-10`, which points to `main` after PR #7.

---

## 0. Executive summary

- **The engine is right; the look isn't there yet.** What exists today is a working Three.js / React Three Fiber game, and its engine layer is solid: a rules engine, quests, dialogue, narrative memory, resonance powers, saving, and 77 + 177 tests. The visual layer is far from the "premium cinematic fantasy" target. The architecture is built from boxes and cylinders, textures are 512px, there is no post-processing, and the lighting is a plain daylight scene.
- **Recommendation: no engine migration.** Keep Three.js/R3F, Vercel and the iPhone browser. The investment goes into visuals: an art direction, lighting and sky, post-processing, hero assets (the Origin Fragment, the Future Echo), and a modular architecture kit built in Blender.
- **Highest-impact change for the lowest cost:** a fractured cosmic sky plus a lighting and color shift toward the visual bible, together with post-processing (bloom and grading). Next comes the Origin Fragment as a hero asset with a dedicated shader.
- **Higgsfield is not free on this account:** Basic plan, 70 credits, and unlimited generation is not available. Every generation costs credits. Nothing will be spent without approval.
- **Blender:** I recommend headless Blender (`bpy` 5.2.4) running inside the cloud environment. It lets me build GLB models without access to your computer, which matches the iPhone-only workflow. Blender MCP (MIT) only makes sense if you have a desktop computer with Blender.

---

## 1. Technical audit

### 1.1 Repository structure

| Folder | What it is | Status |
|---|---|---|
| `lifeos/` | The main app. Next.js 15 on Vercel, with the LifeOS routes (tasks, goals, habits, calendar, ...) plus `/city`, `/aetheria` and `/play` | Production |
| `lifeos-proto/` | The 3D game layer (Vite). This is where development happens and where the tests run | Source of truth for the game |
| `lifeos/src/game3d`, `lifeos/public/game3d` | A copy of the game inside the app, made by `scripts/sync-game3d.mjs` | Generated copy |
| `lifeos-mobile/`, `app.py` | Older layers (mobile and Python) | Not used by the game |

### 1.2 Rendering stack (verified, not assumed)

- three r187 with @react-three/fiber 9.8, drei 10.7, and @react-three/rapier 2.2 (physics and a kinematic character controller).
- zustand for state, zod 4 for save validation, and Capacitor 7 available for a native build.
- Assets use KTX2 (Basis) and meshopt, built with gltf-transform.
- `postprocessing` and `@react-three/postprocessing` are installed but **not used at all**.
- The app loads the game with `dynamic()` and no SSR on `/aetheria`. The prototype's main JS chunk is about 4.4 MB and needs to be split.

### 1.3 Mapping the modules requested in the brief to what exists

| Requested module | Exists? | Where | Assessment |
|---|---|---|---|
| World Engine / Scene Manager | ✅ | `worlds/registry.ts`, `engine/worldStore.ts`, `World3DHost` | Good: worlds, transitions, routes |
| Environment System | ⚠️ partial | `world/Lighting.tsx`, `Terrain`/`Sky` inside `SanctuaryScene.tsx` | Works, but sits inside an 864-line file and is visually weak |
| Character System | ✅ | `character/*` (Rocketbox, retargeting, facial expressions) | Good engineering; the character itself is a generic model |
| Camera System | ⚠️ | Inside `player/Player.tsx` | Works (orbit plus collisions); not separated; no cinematic camera |
| Animation System | ✅ | `character/animationController.ts` (pure, tested) | Good |
| Interaction System | ✅ | `interactables` (a shared Map) plus prompts | Works; needs a cleaner registration contract |
| Resonance Ability System | ✅ modular | `core/state.ts` (`learnPower`/`resonate`/`SiteDef`), `fx/*` | Data-driven sites rather than hardcoded logic; ready to extend |
| Quest System | ✅ | `core/quests.ts`, accessibility validator | Good, tested |
| Narrative / Dialogue | ✅ | `core/dialogue.ts`, `content/*` | Good, tested |
| Future Echo System | ✅ | `echo/behavior.ts`, `FutureEcho.tsx` | Good behavior; appearance is weak (a transparent clone of the player) |
| Progression | ⚠️ | `avatar/loadout.ts` (tiers), flags/discoveries | Basic; Hero XP and Arena don't exist yet (by design) |
| Persistence | ✅ local | `save/saveStore.ts` (versioned, zod), `bindSaveOnHide` | Good; **local only** (see risks) |
| Asset Management | ⚠️ | `scripts/*` (KTX2/meshopt), `assets-src/` | Pipeline exists; no LOD, no lazy streaming per area |
| Audio System | ❌ | None | High immersion gain for low cost |
| Mobile Performance | ⚠️ | Quality tiers `?q=`, `Bench`, `ContextGuard`, static batching | Foundation exists; **no measurements from a real iPhone yet** |

### 1.4 Working systems (verified by tests and real play)

- **The First Resonance:** the first slice, as confirmed on iPhone.
- **Voices from the Fragment:** the Echo, from Silent Observer to Fragmented Mind.
- **The Sleeping Gate:** the three powers, the Future Companion, and the way-finding (light column and trail).
- Tests: 77 in the prototype and 177 in the app, plus `next build`. Each chapter was also played through in headless Chromium, including a reload.

### 1.5 Constraints and technical debt

1. **Visual debt (the main issue):** procedural primitive geometry, 512px textures, no post-processing, a plain daylight sky. This is exactly the "low-poly mobile" look the brief says to avoid.
2. **`SanctuaryScene.tsx` (864 lines):** it mixes terrain, architecture, story and effects. It needs splitting into an environment module, an architecture module and a story module before the visual rebuild.
3. **The visual layer isn't separated from the physical layer:** colliders sit next to the meshes. For a visual rebuild, the `layout.ts` coordinates and the colliders should become a fixed contract, so new models can't break the stairs, the gallery or the dais.
4. **Sync by copying between `lifeos-proto` and `lifeos`:** this risks divergence. For now it works through a single script; a shared package is a future option.
5. **Local-only persistence:** on iPhone Safari, website storage can be deleted after a long period without visits (ITP). Moving to a server save requires a DB change, and that needs your approval.
6. **No audio, no LOD, no splitting by area.**
7. **Performance testing:** in the cloud, rendering runs without a graphics card (swiftshader, about 3 FPS), which says nothing about iPhone performance. Real measurements require `?stats=1` on your device (automatic quality reduction below 45 FPS already exists).

### 1.6 What must not be broken (preservation list)

- The quest sequences and their flags (`firstResonance`, `echoAwakening`, `sleepingGate`) and the engine rules (only `life:` flags come from real life; the Echo only moves forward).
- The save format (v1, with additive extensions only).
- The `/city` route with demo data by default; the LifeOS systems (tasks, authentication, DB) are untouched.
- The gameplay coordinates in `layout.ts` (stairs, gallery, dais, interaction points).

---

## 2. Visual quality assessment against the references

| Category | Target (references) | Current | Gap |
|---|---|---|---|
| The First Sanctuary | Floating ancient island, a monumental observatory, a fractured sky, floating continents | Flat plateau, a 15 m observatory built from boxes, a daylight sky, small cone "islands" | Very large: scale, sky, architectural detail |
| The Future Echo | A presence of veils and ribbons of light, iridescent, with time threads and fractured geometry | A transparent clone of the player with a fresnel shader and particles | Large: needs its own visual language |
| First Contact | One space that reads as ruins, a futuristic city and a reality of light | A teleport between two separate worlds with a resonance transition | Medium: concept rather than assets |
| The Origin Fragment | An asymmetric dark crystal, 3 internal streams of light, 6 symbols, 5 stages | A symmetric, light octahedron | Large, but entirely solvable in code (a shader) |

Overall assessment: **the engineering is advanced, but the visuals are at early-prototype level.** This is the most important area for the project's quality.

---

## 3. AETHERIA visual bible, v1

### 3.1 The shared language of all four references

- **Base:** dark, deep space (obsidian, smoky violet); the scene is never "noon".
- **Core light:** warm temporal gold. It is the creative energy and the Origin.
- **Fractures:** electric cyan / teal lines. They are the Fracture and the connections (CONNECTION).
- **Highlights:** fine iridescence (violet, green, gold) on edges. They are the Future Echo and transformation (CHANGE).
- **Shape language:**
  - asymmetric fractures;
  - concentric rings and ripples (resonance);
  - vertical threads of light (time);
  - fragments suspended in the air.
- **Scale:** monumental. People are small next to the architecture, and every main structure is at least 3 to 5 times the character's height.

### 3.2 Palette (tokens)

| Token | Value | Use |
|---|---|---|
| `obsidian` | `#0d0b14` | Fragment surface, night shadows |
| `aether-violet` | `#3b2f63` → `#6b5bd2` | Sky, depth, fog |
| `temporal-gold` | `#f2c879` / `#ffd98a` | Creative light, FORM, the Origin |
| `resonance-teal` | `#7ff5e1` | Fractures, CONNECTION, threads |
| `shift-iris` | `#c4a7ff` with green/gold shifts | Future Echo, CHANGE |
| `ancient-stone` | `#c9bfae` (warm), `#8f8577` (shadow) | Architecture |

### 3.3 Materials and lighting

- Stone: 1K–2K PBR (Poly Haven CC0) with trim sheets for edges and decorations, vertex AO, and moss and cracks as decals.
- Crystal: dark glass with fresnel, an internal layer (internal parallax or nested meshes), sharp highlights.
- Light: a low sun or moon from the edge of the frame, warm-cool contrast, height fog, and light rays rendered as cheap planes. Bloom only on emissive elements (selective).
- Avoid: neon everywhere, plastic, uniform lighting, a pale daytime sky.

### 3.4 Guidelines per category

1. **First Sanctuary:** an island floating above a sea of clouds, with the cliff edge visible. The sky is broken by lines of light (the "Fracture" in the sky), with continents in silhouette. The observatory is 2 to 3 times larger: arches, ribbed columns, a split dome.
2. **Future Echo:** a figure of moving veils (ribbons along the bones), a face of light without features, threads of light trailing it, and shards at the fractured points. The form changes by stage: a faint wisp (Observer), shattered and flickering (Fragmented), full and golden (Companion).
3. **First Contact:** one space where the same structure moves between three states: ancient ruins, a futuristic city and a reality of light. It works as a shader blend / dissolve between three versions of the same layout. It will also serve the city ↔ AETHERIA transition.
4. **Origin Fragment:** an asymmetric obsidian crystal. Three internal streams of light in three colors (gold = FORM, violet = CHANGE, teal = CONNECTION). A ring of 6 kingdom symbols that light up, and ripples of resonance in the floor beneath it. Five stages: Dormant → Awakening → Attunement → Convergence → Transcendence.

### 3.5 Separating asset types (a binding rule)

| Type | Source | Goes into the game? |
|---|---|---|
| Concept art | Higgsfield (image), references | No. Reference only |
| Cinematic / promo | Higgsfield (video) | Only as a pre-rendered video (e.g. an opening), with a valid license |
| Real-time 3D | Blender (headless) / CC0 libraries / Image-to-3D after cleanup | Yes, after license, size and performance checks |
| Shaders / effects | Code (GLSL) | Yes. Most of the "magic" is built here |

---

## 4. Evaluating the asset tools

### 4.1 Higgsfield (checked directly against your account)

- **Account status:** Basic plan, **70 credits**, `unlim.available = false`. **Nothing is free on this account.** Every generation consumes credits.
- **What's available:**
  - **Images:** Nano Banana Pro/2, GPT Image 2.x, Seedream 5.x, Soul 2. Good for concept art and the visual bible.
  - **Video:** Seedance 2.0/2.5. Good for a cinematic opening and promotion. The higher-quality modes require a Plus plan or above.
  - **3D:** image-to-3D models (Meshy 6/7, Tripo H3.1/P2, Hunyuan3D v3, SAM 3 3D). These produce GLB files for **props**: statues, relics, debris. They don't suit architecture or terrain, and they need cleanup (polygon count, UVs, materials) before entering the game.
- **License:** I couldn't verify commercial-use terms through the tool. They depend on Higgsfield's terms of service, on the plan, and on each underlying provider. **Before any output goes into the game, the terms need to be checked.**
- **Cost per generation:** shown only in a quote before generation. **I won't spend credits without your explicit approval.**

### 4.2 Blender

| Option | License | Requires | Recommendation |
|---|---|---|---|
| Headless Blender (`pip install bpy`, version 5.2.4 available for Python 3.13 in the environment) | GPL for the tool; the assets created are yours | Nothing on your side; runs in the cloud | **Recommended.** I build modular kits (arches, columns, dome, cliffs) with code, then export to GLB → KTX2/meshopt |
| Blender MCP (`mcp-for-blender`, MIT) | MIT | A computer with Blender open plus Claude Desktop | Only if you work from a computer. Not usable from the cloud environment |

### 4.3 Free libraries (legal priority)

- **Poly Haven:** textures, HDRIs, models. CC0, free for commercial use, no attribution required. Already in use.
- **ambientCG:** CC0 textures. Already in use.
- **Khronos glTF samples:** CC0. Already in use (the lantern).
- **Microsoft Rocketbox:** MIT (the character and its animations). Already in use.
- **Mixamo:** free, but the terms restrict distributing the raw files. Check before use.
- **Sketchfab:** check each model individually. CC-BY requires attribution; NC models are excluded.
- **Fab / Megascans:** the license terms need checking. Don't assume they're free for the web.
- **Avoid** low-poly asset packs (Kenney/Quaternius). They contradict the art direction.

---

## 5. Engine decision

| Option | Advantages | Disadvantages | Verdict |
|---|---|---|---|
| **Three.js/R3F (existing)** | All the systems already work; Vercel; iPhone with no install; tests | Requires discipline to reach premium quality | **Continue** |
| Three.js WebGPU (r187 includes WebGPURenderer) | Modern rendering, compute | Device support needs checking; migrating shaders to TSL | Future option, after measurements |
| Unreal (Pixel Streaming) | Highest quality | Expensive streaming servers, latency, a connection required | Not suitable |
| Unreal / Unity native | Quality and performance | Rebuilding everything, App Store, a Mac for iOS builds; contradicts the iPhone-only workflow | Not now |

---

## 6. Development plan (phases)

Phases 3 (characters and interaction) and 4 (resonance) of the brief have already been implemented at a solid engineering level. From here the order changes, and **visual transformation is the top priority**.

| Phase | Content | Complexity | Main risk |
|---|---|---|---|
| **V0: preparation** (half a session) | Split `SanctuaryScene` into modules (env / architecture / story); freeze the coordinates and colliders as a contract; a baseline tag; device measurement with `?stats=1` | S | No visual change. Pure refactor, tests protect it |
| **V1: sky, light, atmosphere** | A "fractured cosmic" sky shader (gradient, stars, nebula, fracture lines); twilight lighting per the palette; height fog; post-processing (selective bloom, grading, SMAA, vignette) with quality tiers | M | iPhone performance, so tiers are mandatory |
| **V2: the Origin Fragment** | A dark-glass shader with 3 internal streams, a ring of 6 symbols, floor ripples; 5 stages tied to the world state (new field `fragment`, an additive save extension) | M | Low |
| **V3: monumental architecture** | Headless Blender: an observatory kit 2–3× larger (ribbed columns, arches, split dome, trims), cliffs and a floating island, LOD; colliders unchanged (or updated and tested) | L | Breaking colliders, asset size. Done gradually, one structure at a time |
| **V4: the Future Echo** | Veil-and-ribbon presence along the bones, threads of light, shards; a different appearance per stage and per kingdom | M–L | Mobile performance (number of ribbons) |
| **V5: life and sound** | Particles, light rays, vegetation (instancing), wind; ambient sound and effects (CC0) | M | Licensing for sound |
| **Phase 5: world depth** | Hidden discoveries, mechanisms, small puzzles, a walkable bridge to the floating island | M | Scope |
| **Phase 6: first kingdom** | Recommendation: **Knowledge** (observatories, impossible geometry, pattern puzzles), a natural continuation of the observatory and the bridge | XL | Only after the Sanctuary is stable and fast on iPhone |

Quality gate for every stage:
1. code review;
2. unit tests;
3. a run-through in headless Chromium, including a reload;
4. screenshots compared against the visual bible;
5. sync to the app with tsc, tests and build;
6. an iPhone checklist;
7. a PR to `main` only with your approval.

---

## 7. Risks and dependencies

1. **iPhone performance:** the only true measure is your device. Every visual stage comes with quality tiers and a request for a `?stats=1` measurement (live FPS, draw calls, triangles).
2. **App size and loading time:** split assets by area, use KTX2 and meshopt, show a loading indicator, cap the size of each stage.
3. **Licensing:** every asset gets a row in `CREDITS.md` (source, license, commercial use, redistribution). No asset enters without one.
4. **Save deletion on iPhone (ITP):** the recommended fix is a server save, which needs your approval for a DB change. Until then: the save is local and exportable as a file (optional).
5. **The copy sync** between the prototype and the app: always use the script, and run tests on both sides.
6. **Scope:** six kingdoms, an arena and multiplayer are huge. The plan deliberately holds back until the Sanctuary reaches the target quality.
7. **External dependency:** Higgsfield credits (paid), plus a computer with Blender if you want Blender MCP.

---

## 8. What I need from you

1. Approval to start **V0 → V1** (refactor, then sky, lighting and post-processing).
2. A measurement from your iPhone: open `/aetheria?stats=1`, walk around for a minute, and send a screenshot of the counter. This is the performance baseline.
3. A decision on Higgsfield: concept art only within the 70 existing credits, or nothing for now.
4. (Later) a decision on server-side saving.
