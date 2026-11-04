# LifeOS Proto 3D: a realistic character and an urban scene (isolated prototype)

A standalone prototype. **It does not touch `lifeos/`**: no tables, migrations, auth or business logic.
Stack: Vite, React 19, Three.js r187, @react-three/fiber, drei, @react-three/rapier, Zustand, Zod, Capacitor 7.

## Running

```bash
npm install
npm run dev          # http://localhost:5180
npm test             # 21 unit tests (animation, facial, retargeting, LifeOS hookup)
npm run build        # static build in dist/ (base "./", works offline inside Capacitor)
npm run assets       # rebuilds the assets from source (needs network to raw.githubusercontent.com)
```

URL parameters:

| Parameter | Purpose |
|---|---|
| `?q=high\|medium\|low` | Pins the quality tier (turns off automatic quality adjustment) |
| `?tex=webp` | Uses webp textures instead of KTX2 |
| `?bench=1` | Runs a fixed route automatically and records frame times; Copy report gives a JSON report |
| `?stats=1` | Live FPS, draw-call and triangle counters |
| `?touch=1` | Touch controls on desktop as well |
| `?cam=portrait` | Close-up face camera |

Controls: WASD to move · Shift to run · Space to jump · E to interact · G to wave · drag to rotate the camera. On touch screens: a joystick, buttons, and dragging to rotate the camera.

## City vertical slice (default scene)

The default scene is the LifeOS city: central plaza, the LifeOS tower (lobby with doors, a terminal and a life overview), six gates for the six existing districts (wealth, health, knowledge, career, social, mind) with progress and locked/open state, enclosing buildings, a skyline, a monorail, and the HUD from the reference image.
- Data: `src/data/lifeos.ts` (`LifeOSReadAdapter` interface, read-only) and `src/data/mock.ts` (mock only). The game doesn't write tasks and doesn't compute Life XP.
- World Progress (discoveries, unlocked buildings, city construction) is shown separately and labelled "game progress · not Life XP". There is no Energy meter.
- `?scene=test` switches to the physics test scene (stairs, ramps, door).

## Personal avatar (local only)

1. Create the avatar in Avaturn yourself and export it as a **GLB in T-pose**.
2. Save it to `lifeos-proto/assets-src/avatar-user/avatar.glb`. That folder is gitignored.
3. `npm run avatar` checks the skeleton and retargets all the Rocketbox animations onto your skeleton. It aligns the rest poses (A-pose → T-pose) and scales the root motion to your leg length. It also compresses everything (KTX2 + meshopt) and writes to `public/avatar-private/`, which is gitignored and not uploaded anywhere.
4. The `AvatarAssetSource` loader (`src/avatar/avatarSource.ts`) uses the personal file if it exists, otherwise the placeholder (clearly labelled). `?avatar=placeholder` forces the placeholder. Private Supabase Storage is a stub only and needs separate approval.

## Architecture

| Layer | File | Responsibility |
|---|---|---|
| Asset pipeline | `scripts/build-assets.mjs` | Rocketbox FBX → GLB: 18 ARKit-named morph targets, PBR (specular → roughness), clips filtered to the skeleton, **root-motion extraction** (XZ + yaw for turns) into metadata, webp + KTX2, meshopt |
| `CharacterAnimationController` | `src/character/animationController.ts` | Pure FSM (no three): idle/locomotion/stop/turn/air/interact/gesture, crossfades with normalized weights, walk/run blend by **measured** speed with a shared phase, playback rate = speed ÷ stride (no foot sliding), root-motion output, `lockMovement` |
| Adapter | `src/character/threeAnimator.ts` | Applies the frame to an AnimationMixer (the controller owns the clock) and the morph targets |
| Face | `src/character/facial.ts` | Blinks, expressions (happy/focused/surprised), exertion while running |
| Retargeting | `src/character/retarget.ts` | Mixamo → Rocketbox bone map, track renaming plus a coverage check |
| Movement/physics | `src/player/Player.tsx` | Rapier KCC capsule, gravity, jump, autostep 0.32 m, maximum climbable slope 46°, snap-to-ground, pushes dynamic bodies, ground correction via raycast, follow camera with collision |
| World | `src/world/*` | Plaza, street with sidewalks/curbs, a building on a podium, 6 stairs, a 20° ramp, a 50° wedge (not climbable), a hinged door, a kiosk, benches/lamps/bins, 12 trees with 3 LOD levels, static batching per material |
| LifeOS | `src/progression/lifeEvents.ts` | `VerifiedLifeEvent` v1 (a copy of the contract), `LifeEventSink` → visual reactions only. **No XP API** |

## Asset licenses

- Character and animations: Microsoft Rocketbox, MIT (`public/assets/character/LICENSE-Rocketbox.md`)
- Textures: Poly Haven / ambientCG, CC0; lamp: Khronos Lantern, CC0 (`public/assets/env/CREDITS.md`)
- HDRI: Poly Haven "esplanade" via @pmndrs/assets, CC0

## Known limitations (stated honestly)

- **Jump:** the Rocketbox library has no jump clip. The air pose is a single frame taken from run (`placeholder: true` in the metadata). A real clip (for example from Mixamo) needs a retargeting pass. The bone map exists, but it hasn't been tested against a real file.
- **Start clips** (walk_start/run_start) are in the GLB but unused; starting relies on acceleration plus the speed-matched blend.
- **Facial morph targets** are covered by unit tests. Visually, only a static close-up was checked (eyes and hair correct); smile intensity on a real screen still needs review.
- Environment textures are 512px (that's the resolution of the CC0 mirror). The trees are procedural.
- No performance numbers were measured on a real device. Headless testing ran on SwiftShader (a software GPU, 2–16 fps), which says nothing about a phone.

## Device testing (this is the acceptance criterion)

1. `npm run cap:android` (Android Studio) or `npm run cap:ios` (Xcode, on a Mac). Run on a **physical device**, not an emulator.
2. In the app, open `index.html?bench=1&q=medium` (or change the default with `?q=`). To pass parameters inside Capacitor, edit `server.url`/`appendUserAgent` during testing, or run the dev server on the local network (`npm run dev` → `http://<ip>:5180/?bench=1`) from the phone's browser as an indicative test.
3. Wait for the route to finish (about 60–90 s), then press **Copy report** and send the JSON.
4. Targets: capable device p95 ≤ 17.5 ms (60fps) at `high`/`medium`; mid-range device p95 ≤ 34 ms (30fps) at `medium`/`low`.
5. Also record: thermal throttling after 10 minutes, load time, and visual issues (foot sliding, shadows, LOD pop-in).
