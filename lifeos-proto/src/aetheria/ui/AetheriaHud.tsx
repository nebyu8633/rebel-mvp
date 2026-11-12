/**
 * AETHERIA HUD: quest tracker, narrative title cards, journal, kingdoms, interaction prompt.
 * Shows only game state; no LifeOS data, no XP. Real-life memories appear (optional) in the journal.
 */
import { useEffect, useState } from "react";
import { useAetheria } from "../store";
import { useAetheriaUi } from "./uiStore";
import { questStatus } from "../core/quests";
import { ECHO_TITLES, FORCES, FORCE_TITLES } from "../core/model";
import { FORCE_FX } from "../fx/casts";
import { SIGILS, F, memoryShards } from "../content/firstResonance";
import { JOURNAL, currentQuest } from "../content";
import { MEM } from "../content/echoAwakening";
import { useDialogue } from "./dialogueRunner";
import { sound, unlock } from "../audio/soundscape";
import { useProto } from "../../store";
import { ActionButtons, Stick } from "../../ui/Controls";
import { WorldSwitcher } from "../../ui/WorldUi";

const CSS = `
.ae{position:absolute;inset:0;pointer-events:none;direction:rtl;color:#f3ead7;font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif}
.ae-p{pointer-events:auto;background:linear-gradient(180deg,rgba(20,18,30,.80),rgba(12,12,22,.72));border:1px solid rgba(214,180,110,.35);border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.4)}
.ae-t{font-weight:700;letter-spacing:.3px;color:#e9c987}
.ae-btn{pointer-events:auto;border:1px solid rgba(214,180,110,.45);background:rgba(20,18,30,.75);color:#f3ead7;border-radius:12px;padding:7px 12px;font-size:13px;cursor:pointer}
.ae-card{position:absolute;left:50%;top:18%;transform:translateX(-50%);width:min(560px,90vw);text-align:center;padding:18px 22px;pointer-events:auto}
.ae-modal{position:absolute;inset:0;display:grid;place-items:center;background:rgba(0,0,0,.4);pointer-events:auto}
.ae-modal>.ae-p{width:min(580px,92vw);max-height:80vh;overflow:auto;padding:16px 18px}
@keyframes aeIn{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}
@keyframes aeFrag{0%,92%,100%{opacity:1;transform:none;filter:none}93%{opacity:.55;transform:translateX(2px);filter:blur(.6px)}96%{opacity:.85;transform:translateX(-1px)}}
.ae-frag{animation:aeFrag 2.3s infinite steps(1)}
`;

const DONE_TEXT: Record<string, string> = {
  first_resonance: "הושלם. שש הממלכות נחשפו.",
  echo_awakening: "הושלם. ההד זוכר אותך.",
  sleeping_gate: "הושלם. השער ער, וההד הולך איתך.",
  bridge_to_kingdom: "הושלם. ממלכת הידע מחכה מעבר לסף.",
  memory_shards: "הושלם. ההד זוכר עכשיו את השבר.",
};

/** Resonance powers: pick the force to use (tap, or keys 1/2/3). Only learned forces are usable. */
function PowerBar() {
  const powers = useAetheria((s) => s.world.powers);
  const bond = useAetheria((s) => s.world.memory[MEM.bond]);
  const power = useAetheriaUi((s) => s.power);
  const setPower = useAetheriaUi((s) => s.setPower);
  const learned = powers ?? [];
  // default to the force the Echo heard (the bond), else the first learned one
  useEffect(() => {
    if (power && learned.includes(power)) return;
    const pick = learned.find((f) => f === bond) ?? learned[0] ?? null;
    if (pick !== power) setPower(pick);
  }, [learned, bond, power, setPower]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const i = ["Digit1", "Digit2", "Digit3"].indexOf(e.code);
      if (i >= 0 && learned.includes(FORCES[i])) setPower(FORCES[i]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [learned, setPower]);
  if (!learned.length) return null;
  return (
    <div data-testid="powers" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", display: "grid", gap: 8, pointerEvents: "auto" }}>
      {FORCES.map((f, i) => {
        const has = learned.includes(f);
        const on = power === f;
        const fx = FORCE_FX[f];
        return (
          <button
            key={f}
            data-testid={`power-${f}`}
            aria-pressed={on}
            disabled={!has}
            onClick={() => setPower(f)}
            className="ae-btn"
            style={{
              width: 64,
              height: 52,
              padding: 0,
              borderRadius: 14,
              fontSize: 13,
              fontWeight: 700,
              opacity: has ? 1 : 0.3,
              color: has ? fx.color : "#888",
              borderColor: on ? fx.color : "rgba(214,180,110,.35)",
              boxShadow: on ? `0 0 14px ${fx.glow}, inset 0 0 10px ${fx.glow}` : "none",
              background: on ? "rgba(30,26,44,.92)" : "rgba(20,18,30,.7)",
            }}
          >
            {FORCE_TITLES[f]}
            <div style={{ fontSize: 10, opacity: 0.6, fontWeight: 400 }}>{i + 1}</div>
          </button>
        );
      })}
    </div>
  );
}

function Hint({ touch }: { touch: boolean }) {
  const hint = useAetheriaUi((s) => s.hint);
  if (!hint) return null;
  return (
    <div key={hint.id} className="ae-p" data-testid="hint" style={{ position: "absolute", left: "50%", bottom: touch ? 232 : 92, transform: "translateX(-50%)", padding: "8px 14px", fontSize: 13, maxWidth: "88vw", textAlign: "center", animation: "aeIn .25s ease-out", borderColor: "rgba(159,216,255,.45)" }}>
      {hint.text}
    </div>
  );
}

function QuestTracker() {
  const world = useAetheria((s) => s.world);
  const quest = currentQuest(world);
  const st = questStatus(quest, world);
  return (
    <div className="ae-p" style={{ padding: "10px 14px", maxWidth: 300 }} data-testid="quest">
      <div className="ae-t" style={{ fontSize: 13 }}>✦ {quest.title}</div>
      {st.state === "active" && (
        <div style={{ fontSize: 13, marginTop: 4 }}>
          {st.step.text}
          <div style={{ fontSize: 11, opacity: 0.65, marginTop: 2 }}>
            שלב {st.index + 1} מתוך {quest.steps.length}
          </div>
        </div>
      )}
      {st.state === "complete" && <div style={{ fontSize: 13, marginTop: 4 }}>{DONE_TEXT[quest.id] ?? "הושלם."}</div>}
      {world.echo !== "dormant" && <div style={{ fontSize: 11, marginTop: 6, color: "#9fd8ff" }}>הד העתיד: {ECHO_TITLES[world.echo]}</div>}
    </div>
  );
}

function TitleCard() {
  const card = useAetheriaUi((s) => s.card);
  const next = useAetheriaUi((s) => s.nextCard);
  useEffect(() => {
    if (!card) return;
    const t = setTimeout(next, Math.min(14000, 4500 + (card.body?.length ?? 0) * 45));
    return () => clearTimeout(t);
  }, [card, next]);
  if (!card) return null;
  const color = card.tone === "echo" ? "#9fd8ff" : card.tone === "resonance" ? "#ffe2a0" : "#e9c987";
  return (
    <div className="ae-p ae-card" onClick={next} style={{ animation: "aeIn .6s ease", borderColor: color + "88" }} data-testid="card">
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{card.title}</div>
      {card.body && <div style={{ fontSize: 14, lineHeight: 1.6, marginTop: 8, opacity: 0.92 }}>{card.body}</div>}
      <div style={{ fontSize: 11, opacity: 0.5, marginTop: 8 }}>הקישו להמשך</div>
    </div>
  );
}

function Panels() {
  const panel = useAetheriaUi((s) => s.panel);
  const setPanel = useAetheriaUi((s) => s.setPanel);
  const world = useAetheria((s) => s.world);
  if (!panel) return null;
  const shards = memoryShards(world);
  return (
    <div className="ae-modal" onClick={() => setPanel(null)} data-testid="ae-panel">
      <div className="ae-p" onClick={(e) => e.stopPropagation()}>
        <button className="ae-btn" style={{ float: "left" }} onClick={() => setPanel(null)}>
          ✕
        </button>
        {panel === "journal" && (
          <>
            <div className="ae-t" style={{ fontSize: 18, marginBottom: 8 }}>
              יומן האדריכל
            </div>
            {world.journal.length === 0 && <div style={{ opacity: 0.7, fontSize: 13 }}>היומן עדיין ריק.</div>}
            {typeof world.memory?.[MEM.bond] === "string" && (
              <div style={{ fontSize: 12, color: "#c4a7ff", marginBottom: 8 }}>
                הקשר עם ההד: {{ form: "צורה", change: "שינוי", connection: "חיבור" }[world.memory[MEM.bond] as string]}
              </div>
            )}
            {world.journal.map((j) => (
              <div key={j.id} style={{ marginBottom: 12 }}>
                <div className="ae-t" style={{ fontSize: 14 }}>
                  {JOURNAL[j.id]?.title ?? j.id}
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.6, opacity: 0.9 }}>{JOURNAL[j.id]?.body}</div>
              </div>
            ))}
            {shards.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 12, color: "#9fd8ff" }}>
                זיכרונות מהעולם האמיתי (רשות): {shards.map((k) => SIGILS.find((s) => s.kingdom === k)?.title).join(", ")}
              </div>
            )}
          </>
        )}
        {panel === "kingdoms" && (
          <>
            <div className="ae-t" style={{ fontSize: 18, marginBottom: 8 }}>
              שש הממלכות
            </div>
            {!world.flags.includes(F.kingdoms) ? (
              <div style={{ opacity: 0.7, fontSize: 13 }}>החותמות עדיין לא נקראו.</div>
            ) : (
              SIGILS.map((s) => (
                <div key={s.kingdom} style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 8 }}>
                  <span style={{ color: s.color, fontSize: 18 }}>◆</span>
                  <div>
                    <div style={{ fontWeight: 700, color: s.color }}>{s.title}</div>
                    <div style={{ fontSize: 13, opacity: 0.85 }}>{s.line}</div>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SoundToggle() {
  const [muted, setMuted] = useState(sound.muted);
  useEffect(() => sound.onChange(setMuted), []);
  return (
    <button className="ae-btn" data-testid="sound" onClick={() => (unlock(), sound.setMuted(!muted))}>
      {muted ? "🔇 צליל: כבוי" : "🔊 צליל: פועל"}
    </button>
  );
}

function Settings() {
  const [open, setOpen] = useState(false);
  const quality = useProto((s) => s.quality);
  const set = useProto((s) => s.set);
  return (
    <div style={{ position: "relative" }}>
      <button className="ae-btn" onClick={() => setOpen((o) => !o)} data-testid="settings" style={{ width: 40, height: 40, padding: 0, borderRadius: "50%" }}>
        ⚙
      </button>
      {open && (
        <div className="ae-p" style={{ position: "absolute", top: 46, left: 0, width: 240, padding: 10, display: "grid", gap: 6, fontSize: 12 }}>
          <WorldSwitcher />
          <label>
            איכות{" "}
            <select value={quality} onChange={(e) => set({ quality: e.target.value as typeof quality })}>
              <option value="high">גבוהה</option>
              <option value="medium">בינונית</option>
              <option value="low">נמוכה</option>
            </select>
          </label>
          <SoundToggle />
          <button
            className="ae-btn"
            onClick={() => {
              if (confirm("לאפס את ההתקדמות ב־AETHERIA (מקומי בלבד)?")) void useAetheria.getState().reset().then(() => location.reload());
            }}
          >
            איפוס התקדמות AETHERIA
          </button>
        </div>
      )}
    </div>
  );
}

const ECHO_STAGE_STYLE: Record<string, { name: string; color: string; glow: string }> = {
  silent_observer: { name: "הצופה השקט", color: "#bfeeff", glow: "rgba(159,227,255,.6)" },
  fragmented_mind: { name: "התודעה המפוצלת", color: "#d9c8ff", glow: "rgba(196,167,255,.75)" },
  future_companion: { name: "בן הלוויה העתידי", color: "#ffe9b8", glow: "rgba(255,226,160,.6)" },
};

/** Conversation panel. The Echo's lines flicker like a broken signal while it is the Fragmented Mind. */
function DialoguePanel({ touch }: { touch: boolean }) {
  const view = useDialogue((s) => s.view);
  const pick = useDialogue((s) => s.pick);
  const close = useDialogue((s) => s.close);
  const echo = useAetheria((s) => s.world.echo);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    setShown(0);
    if (!view) return;
    const t = setInterval(() => setShown((n) => (n >= view.text.length ? n : n + 2)), 28);
    return () => clearInterval(t);
  }, [view]);
  if (!view) return null;
  const typing = shown < view.text.length;
  const style = ECHO_STAGE_STYLE[echo] ?? ECHO_STAGE_STYLE.silent_observer;
  const isEcho = view.speaker === "echo";
  const advance = () => (typing ? setShown(view.text.length) : view.continues ? pick(null) : undefined);
  return (
    <div className="ae-p" data-testid="dialogue" onClick={advance} style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: touch ? 196 : 36, width: "min(620px, 94vw)", padding: "14px 18px", pointerEvents: "auto", borderColor: isEcho ? style.glow : "rgba(214,180,110,.35)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: isEcho ? style.color : "#e9c987" }}>{isEcho ? `הד העתיד · ${style.name}` : "✦"}</span>
        <button className="ae-btn" style={{ padding: "2px 9px" }} onClick={(e) => (e.stopPropagation(), close())} aria-label="סגור">
          ✕
        </button>
      </div>
      <div className={isEcho && echo === "fragmented_mind" ? "ae-frag" : undefined} style={{ fontSize: isEcho ? 17 : 15, lineHeight: 1.6, minHeight: 50, fontStyle: isEcho ? "normal" : "italic", color: isEcho ? style.color : "#f3ead7", textShadow: isEcho ? `0 0 12px ${style.glow}` : "none" }}>
        {view.text.slice(0, shown)}
      </div>
      {!typing && view.choices.length > 0 && (
        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          {view.choices.map((c) => (
            <button key={c.id} className="ae-btn" data-testid={`choice-${c.id}`} onClick={(e) => (e.stopPropagation(), pick(c.id))} style={{ textAlign: "right", fontSize: 14, padding: "9px 12px" }}>
              › {c.text}
            </button>
          ))}
        </div>
      )}
      {!typing && view.continues && <div style={{ fontSize: 11, opacity: 0.55, marginTop: 8 }}>{view.ends ? "הקישו לסיום" : "הקישו להמשך"}</div>}
    </div>
  );
}

export function AetheriaHud({ touch }: { touch: boolean }) {
  const prompt = useProto((s) => s.prompt);
  const setPanel = useAetheriaUi((s) => s.setPanel);
  const discovered = useAetheria((s) => s.world.flags.includes(F.kingdoms));
  const saveError = useAetheria((s) => s.saveError);
  return (
    <div className="ae">
      <style>{CSS}</style>
      <div style={{ position: "absolute", top: 10, right: 10 }}>
        <QuestTracker />
      </div>
      <div style={{ position: "absolute", top: 10, left: 10, display: "flex", gap: 8, alignItems: "center" }}>
        <Settings />
        <button className="ae-btn" onClick={() => setPanel("journal")} data-testid="journal">
          📖 יומן
        </button>
        {discovered && (
          <button className="ae-btn" onClick={() => setPanel("kingdoms")}>
            ✦ ממלכות
          </button>
        )}
      </div>
      {prompt && (
        <div className="ae-p" data-testid="prompt" style={{ position: "absolute", left: "50%", bottom: touch ? 180 : 40, transform: "translateX(-50%)", padding: "8px 14px", fontSize: 14, whiteSpace: "nowrap" }}>
          {touch ? "״פעולה״" : "E"} — {prompt}
        </div>
      )}
      {saveError && (
        <div className="ae-p" data-testid="save-error" style={{ position: "absolute", top: 60, left: 10, maxWidth: 280, padding: "6px 10px", fontSize: 12, borderColor: "rgba(255,120,120,.6)" }}>
          ההתקדמות לא נשמרת במכשיר הזה (גלישה פרטית או אחסון מלא). אפשר להמשיך לשחק, אבל ההתקדמות תאבד בסגירה.
        </div>
      )}
      <PowerBar />
      <Hint touch={touch} />
      <TitleCard />
      <DialoguePanel touch={touch} />
      <Panels />
      {touch && (
        <div style={{ pointerEvents: "auto" }}>
          <Stick />
          <ActionButtons />
        </div>
      )}
    </div>
  );
}
