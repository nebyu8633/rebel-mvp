/** The First Sanctuary: story triggers, the Resonance sequence, and the Future Echo controller. */
import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { interactables } from "../../../store";
import { telemetry } from "../../../player/Player";
import { gameEvents, playerReactions } from "../../../engine/events";
import { useAetheria } from "../../store";
import { useAetheriaUi } from "../../ui/uiStore";
import { F, JOURNAL, canReadSigils, canResonate, onArrive, onObservatory, onReadSigils, onResonanceComplete, onTerrace, onTouchFragment } from "../../content/firstResonance";
import { FLOOR_Y, GALLERY, SIGIL_WALL, around, insideObservatory, onGallery } from "./layout";
import { FutureEcho } from "./FutureEcho";
import { E, FIRST_TOUCH, MEM, echoDialogueFor, echoWaits } from "../../content/echoAwakening";
import { useDialogue } from "../../ui/dialogueRunner";
import { RESONANCE_S, resonance } from "./shared";

// ------------------------------------------------------------------ story triggers + the resonance sequence
export function Story() {
  const world = useAetheria((s) => s.world);
  const hydrated = useAetheria((s) => s.hydrated);
  const dispatch = useAetheria((s) => s.dispatch);
  const showCard = useAetheriaUi((s) => s.showCard);
  const [, force] = useState(0);
  const acc = useRef(0);

  // returning after the Resonance: the world is already changed (persistent consequence)
  useEffect(() => {
    if (!hydrated) return;
    resonance.p = world.flags.includes(F.resonance) ? 1 : 0;
    resonance.running = false;
  }, [hydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!hydrated || world.flags.includes(F.arrived)) return;
    if (dispatch(onArrive())) {
      // the Living Architect's starter kit (World Progress, never Life XP)
      const st = useAetheria.getState();
      st.equipItem("architect_staff");
      st.equipItem("wayfinder_lantern");
      showCard({ title: JOURNAL["j.sanctuary"].title, body: JOURNAL["j.sanctuary"].body, tone: "discovery" });
    }
  }, [hydrated, world.flags, dispatch, showCard]);

  // the Origin Fragment: touch it, then (with the rings aligned) awaken the Resonance
  const touched = world.flags.includes(F.fragment);
  const ready = canResonate(world);
  useEffect(() => {
    if (!hydrated) return;
    const ip = around(180, 1.9);
    const label = !touched ? "גע באור שבמרכז המצפה" : ready ? "עוררו את התהודה" : null;
    if (!label || resonance.running) {
      interactables.delete("fragment");
      return;
    }
    interactables.set("fragment", {
      id: "fragment",
      label,
      x: ip.x,
      y: FLOOR_Y,
      z: ip.z,
      radius: 1.8,
      onContact: () => {
        const s = useAetheria.getState().world;
        if (!s.flags.includes(F.fragment)) {
          if (useAetheria.getState().dispatch(onTouchFragment(s))) {
            useAetheria.getState().equipItem("origin_pendant");
            playerReactions.emit("surprise");
            showCard({ title: JOURNAL["j.fragment"].title, body: JOURNAL["j.fragment"].body, tone: "discovery" });
            showCard({ title: JOURNAL["j.echo"].title, body: JOURNAL["j.echo"].body, tone: "echo" });
          }
        } else if (canResonate(s) && !resonance.running) {
          resonance.running = true;
          gameEvents.emit("resonance");
          resonance.t = 0;
          interactables.delete("fragment");
          playerReactions.emit("surprise");
          force((n) => n + 1);
        }
      },
    });
    return () => void interactables.delete("fragment");
  }, [hydrated, touched, ready, showCard]);

  // sigils: readable once the stair is whole and the player stands on the gallery
  const sigilsReady = canReadSigils(world);
  useEffect(() => {
    if (!world.flags.includes(F.resonance) || world.flags.includes(F.kingdoms)) return;
    const ip = around(SIGIL_WALL.bearing, 6.2);
    interactables.set("sigils", {
      id: "sigils",
      label: "קראו את חותמות הבריאה",
      x: ip.x,
      y: GALLERY.y,
      z: ip.z,
      radius: 2.4,
      onContact: () => {
        if (useAetheria.getState().dispatch(onReadSigils())) {
          playerReactions.emit("celebrate");
          showCard({ title: JOURNAL["j.kingdoms"].title, body: JOURNAL["j.kingdoms"].body, tone: "discovery" });
          useAetheriaUi.getState().setPanel("kingdoms");
        }
      },
    });
    return () => void interactables.delete("sigils");
  }, [world.flags, sigilsReady, showCard]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    // the world already resonated (save, or a state change from elsewhere): show the changed world
    if (!resonance.running && resonance.p < 1 && useAetheria.getState().world.flags.includes(F.resonance)) resonance.p = 1;
    if (resonance.running) {
      resonance.t += dt;
      resonance.p = Math.min(1, resonance.t / RESONANCE_S);
      if (resonance.p >= 1) {
        resonance.running = false;
        if (useAetheria.getState().dispatch(onResonanceComplete())) {
          playerReactions.emit("celebrate");
          showCard({ title: JOURNAL["j.resonance"].title, body: JOURNAL["j.resonance"].body, tone: "resonance" });
        }
      }
    }
    acc.current += dt;
    if (acc.current < 0.2 || !useAetheria.getState().hydrated) return;
    acc.current = 0;
    const s = useAetheria.getState().world;
    if (!s.flags.includes(F.observatory) && insideObservatory(telemetry.x, telemetry.z)) useAetheria.getState().dispatch(onObservatory());
    if (s.flags.includes(F.resonance) && !s.flags.includes(F.terrace) && onGallery(telemetry.x, telemetry.y, telemetry.z)) useAetheria.getState().dispatch(onTerrace());
  });
  return null;
}

// ------------------------------------------------------------------ the Future Echo: behaviour + story hooks
const ECHO_ANCHORS = [around(95, 6.4), around(30, 6.4), around(-45, 6.5)].map((p) => ({ x: p.x, y: GALLERY.y, z: p.z }));
const ECHO_WAIT = (() => {
  const p = around(25, 6.35);
  return { x: p.x, y: GALLERY.y, z: p.z };
})();

export function EchoController() {
  const world = useAetheria((s) => s.world);
  const hydrated = useAetheria((s) => s.hydrated);
  const inDialogue = useDialogue((s) => !!s.defId);
  const waiting = echoWaits(world);
  const offer = echoDialogueFor(world);

  // narrative memory: every return to the sanctuary is remembered
  const counted = useRef(false); // refs survive StrictMode's simulated remount, so this counts once per visit
  useEffect(() => {
    if (!hydrated || counted.current) return;
    counted.current = true;
    useAetheria.getState().dispatch([{ type: "count", key: MEM.visits }]);
  }, [hydrated]);

  // the Echo can be spoken to (or touched) when the story offers a conversation
  useEffect(() => {
    if (!offer || inDialogue) {
      interactables.delete("echo");
      return;
    }
    // centred on the Echo itself: the gallery is narrow, so any reachable spot beside it is within the radius
    const front = ECHO_WAIT;
    interactables.set("echo", {
      id: "echo",
      label: offer === FIRST_TOUCH ? "הושיטו יד אל הד העתיד" : "לדבר עם הד העתיד",
      x: front.x,
      y: GALLERY.y,
      z: front.z,
      radius: 2.4,
      onContact: () => useDialogue.getState().open(offer),
    });
    return () => void interactables.delete("echo");
  }, [offer, inDialogue]);

  // approaching the waiting Echo is a story beat
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.25) return;
    acc.current = 0;
    const s = useAetheria.getState().world;
    if (!echoWaits(s) || s.flags.includes(E.approached)) return;
    if (Math.abs(telemetry.y - GALLERY.y) < 1.2 && Math.hypot(telemetry.x - ECHO_WAIT.x, telemetry.z - ECHO_WAIT.z) < 3.6) useAetheria.getState().dispatch([{ type: "setFlag", flag: E.approached }]);
  });

  return <FutureEcho stage={world.echo} anchors={ECHO_ANCHORS} waitAnchor={ECHO_WAIT} waiting={waiting || world.echo !== "silent_observer"} inDialogue={inDialogue} />;
}
