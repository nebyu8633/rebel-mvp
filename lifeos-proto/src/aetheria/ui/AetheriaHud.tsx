/**
 * AETHERIA HUD: quest tracker, narrative title cards, journal, kingdoms, interaction prompt.
 * Shows only game state; no LifeOS data, no XP. Real-life memories appear (optional) in the journal.
 */
import { useEffect, useState } from "react";
import { useAetheria } from "../store";
import { useAetheriaUi } from "./uiStore";
import { questStatus } from "../core/quests";
import { ECHO_TITLES } from "../core/model";
import { FIRST_RESONANCE, JOURNAL, SIGILS, F, memoryShards } from "../content/firstResonance";
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
`;

function QuestTracker() {
  const world = useAetheria((s) => s.world);
  const st = questStatus(FIRST_RESONANCE, world);
  return (
    <div className="ae-p" style={{ padding: "10px 14px", maxWidth: 300 }} data-testid="quest">
      <div className="ae-t" style={{ fontSize: 13 }}>✦ {FIRST_RESONANCE.title}</div>
      {st.state === "active" && (
        <div style={{ fontSize: 13, marginTop: 4 }}>
          {st.step.text}
          <div style={{ fontSize: 11, opacity: 0.65, marginTop: 2 }}>
            שלב {st.index + 1} מתוך {FIRST_RESONANCE.steps.length}
          </div>
        </div>
      )}
      {st.state === "complete" && <div style={{ fontSize: 13, marginTop: 4 }}>הושלם. שש הממלכות נחשפו.</div>}
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
      <TitleCard />
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
