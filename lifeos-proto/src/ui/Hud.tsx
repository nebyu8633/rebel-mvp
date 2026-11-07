/** HUD (Hebrew, RTL): status, interaction prompt, mock LifeOS feed, settings. */
import { useState } from "react";
import { useProgress } from "@react-three/drei";
import { useProto, type Quality } from "../store";
import { emitMockCorrection } from "../progression/useProgression";
import { WorldSwitcher } from "./WorldUi";

const panel: React.CSSProperties = { background: "rgba(8,12,18,0.72)", borderRadius: 12, padding: "8px 12px", fontSize: 13, lineHeight: 1.5, border: "1px solid rgba(255,255,255,0.08)" };

const STATE_HE: Record<string, string> = { idle: "עמידה", locomotion: "תנועה", stop: "עצירה", turn: "סיבוב במקום", air: "באוויר", interact: "אינטראקציה", gesture: "נפנוף" };

export function Hud({ touch }: { touch: boolean }) {
  const prompt = useProto((s) => s.prompt);
  const state = useProto((s) => s.animState);
  const reactions = useProto((s) => s.reactions);
  const debug = useProto((s) => s.debug);
  const quality = useProto((s) => s.quality);
  const set = useProto((s) => s.set);
  const [open, setOpen] = useState(false);
  return (
    <>
      <div style={{ position: "absolute", top: 10, right: 10, display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end", maxWidth: 300 }}>
        <div style={panel}>
          <b>LifeOS · אב־טיפוס</b> · {STATE_HE[state] ?? state}
          <button onClick={() => setOpen((o) => !o)} style={{ marginInlineStart: 8, fontSize: 12 }} data-testid="settings">
            ⚙
          </button>
          {open && (
            <div style={{ marginTop: 6, display: "grid", gap: 4 }}>
              <label>
                <input type="checkbox" checked={debug.rootMotionStops} onChange={(e) => set({ debug: { ...debug, rootMotionStops: e.target.checked } })} /> עצירה עם Root Motion
              </label>
              <label>
                <input type="checkbox" checked={debug.showColliders} onChange={(e) => set({ debug: { ...debug, showColliders: e.target.checked } })} /> הצג מתנגשים (Rapier)
              </label>
              <label>
                איכות{" "}
                <select value={quality} onChange={(e) => set({ quality: e.target.value as Quality })}>
                  <option value="high">גבוהה</option>
                  <option value="medium">בינונית</option>
                  <option value="low">נמוכה</option>
                </select>
              </label>
              <WorldSwitcher />
              <button onClick={emitMockCorrection} style={{ fontSize: 12 }}>
                שלח אירוע תיקון (ביטול אימות אחרון)
              </button>
              {!touch && <div style={{ opacity: 0.75 }}>WASD תנועה · Shift ריצה · רווח קפיצה · E פעולה · G נפנוף · גרירה: מצלמה</div>}
            </div>
          )}
        </div>
        {reactions.length > 0 && (
          <div style={panel} data-testid="feed">
            <div style={{ fontWeight: 600 }}>אירועי LifeOS (דמו)</div>
            {reactions.slice(0, 4).map((r) => (
              <div key={r.eventId} style={{ opacity: r.kind === "revert" ? 0.7 : 1 }}>
                {r.kind === "revert" ? "↩" : "✓"} {r.label}
                {r.domain ? ` · ${r.domain}` : ""}
              </div>
            ))}
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>אירועים מדומים בלבד. המשחק לא מעניק Life XP; ה־XP נקבע רק בשרת LifeOS.</div>
          </div>
        )}
      </div>
      {prompt && (
        <div data-testid="prompt" style={{ ...panel, position: "absolute", left: "50%", bottom: touch ? 170 : 40, transform: "translateX(-50%)", whiteSpace: "nowrap" }}>
          {touch ? "לחצו ״פעולה״" : "E"} — {prompt}
        </div>
      )}
    </>
  );
}

export function Loader() {
  const { progress, active } = useProgress();
  const ready = useProto((s) => s.ready);
  if (ready && !active) return null;
  return (
    <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "#0b0f14", zIndex: 10 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 15, marginBottom: 8 }}>טוען דמות וסביבה…</div>
        <div style={{ width: 220, height: 4, background: "#1d2630", borderRadius: 2 }}>
          <div style={{ width: `${Math.round(progress)}%`, height: 4, background: "#3fb6ff", borderRadius: 2 }} />
        </div>
      </div>
    </div>
  );
}
