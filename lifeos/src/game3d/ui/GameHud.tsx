/**
 * LifeOS city HUD — layout follows the visual reference (profile/level, life progress, next goal,
 * active tasks, districts, current location, world progress, minimap, bottom bar).
 *
 * Rules (from the product decisions):
 *  - Life XP / level are LifeOS data (read-only; mock here) — the game never grants Life XP.
 *  - World Progress (discoveries, unlocked buildings, city construction) is shown separately.
 *  - No energy meter, no XP rewards for game activity.
 *  - Tasks are displayed, never completed here: completion happens in LifeOS.
 */
import { useEffect, useRef, useState } from "react";
import { useProto } from "../store";
import { DISTRICTS, PLAZA, TOWER, AVENUE, developmentStage, dirOf, gatePos, locate, type DistrictDef } from "../city/layout";
import { nextGoal, overallProgress, type Domain, type LifeOSSnapshot } from "../data/lifeos";
import { telemetry } from "../player/Player";
import { emitMockCorrection } from "../progression/useProgression";
import { ActionButtons, Stick } from "./Controls";
import { DEMO_EVENTS } from "../config";
import { WorldSwitcher } from "./WorldUi";
import { goToWorld, worldAvailable } from "../engine/worldStore";

const CSS = `
.hud{position:absolute;inset:0;pointer-events:none;font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;color:#eef3f8;direction:rtl}
.hud *{box-sizing:border-box}
.gp{pointer-events:auto;background:linear-gradient(180deg,rgba(14,20,34,.78),rgba(10,14,26,.70));border:1px solid rgba(255,255,255,.10);border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,.35);backdrop-filter:none}
.gp h4{margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:.2px}
.bar{height:7px;border-radius:5px;background:rgba(255,255,255,.12);overflow:hidden}
.bar>i{display:block;height:100%;border-radius:5px}
.chip{font-size:10px;padding:1px 6px;border-radius:8px;background:rgba(255,255,255,.12);margin-inline-start:6px;font-weight:600;opacity:.85}
.tile{border-radius:12px;padding:7px 8px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);cursor:pointer;text-align:right;color:inherit;font:inherit}
.tile:active{transform:scale(.98)}
.btm{pointer-events:auto;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11px;color:#dfe8f2;background:none;border:none;cursor:pointer}
.btm span{display:grid;place-items:center;width:46px;height:46px;border-radius:50%;background:rgba(14,20,34,.75);border:1px solid rgba(255,255,255,.14);font-size:20px}
.modal{position:absolute;inset:0;display:grid;place-items:center;background:rgba(0,0,0,.35);pointer-events:auto}
.modal>.gp{width:min(560px,92vw);max-height:80vh;overflow:auto;padding:16px}
.x{float:left;background:rgba(255,255,255,.1);border:none;color:#fff;border-radius:8px;padding:2px 9px;cursor:pointer;font-size:14px}
`;

const LABEL: Record<Domain, string> = { wealth: "עושר", health: "בריאות", knowledge: "ידע", career: "קריירה", social: "חברה", mind: "נפש" };
const ICON: Record<Domain, string> = { wealth: "💰", health: "💚", knowledge: "📚", career: "💼", social: "🤝", mind: "🧘" };
const pct = (v: number) => `${Math.round(v * 100)}%`;
const districtOf = (id: Domain) => DISTRICTS.find((d) => d.id === id)!;

function Ring({ value, size = 64, color = "#22d3ee" }: { value: number; size?: number; color?: string }) {
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ flex: "none" }}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,.12)" strokeWidth={7} fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={7} fill="none" strokeDasharray={`${c * value} ${c}`} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="54%" textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={size * 0.26} fontWeight={700}>
        {pct(value)}
      </text>
    </svg>
  );
}

function Profile({ s, compact }: { s: LifeOSSnapshot; compact?: boolean }) {
  const avatar = useProto((st) => st.avatar);
  const p = s.profile;
  const f = (p.lifeXp - p.levelFloorXp) / (p.nextLevelXp - p.levelFloorXp);
  return (
    <div className="gp" style={{ display: "flex", gap: 10, alignItems: "center", padding: compact ? "6px 10px" : "10px 14px" }}>
      <div style={{ width: compact ? 38 : 54, height: compact ? 38 : 54, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%,#6b7a90,#283244)", border: "2px solid #8b5cf6", display: "grid", placeItems: "center", fontSize: compact ? 18 : 24 }} title={avatar?.label}>
        {avatar?.placeholder === false ? "🙂" : "👤"}
      </div>
      <div style={{ minWidth: compact ? 120 : 170 }}>
        <div style={{ fontWeight: 800, fontSize: compact ? 14 : 18 }}>
          רמה {p.level}
          <span className="chip">Life XP · LifeOS</span>
        </div>
        <div className="bar" style={{ margin: "4px 0 2px" }}>
          <i style={{ width: pct(f), background: "linear-gradient(90deg,#a855f7,#ec4899)", marginInlineStart: "auto" }} />
        </div>
        <div style={{ fontSize: 11, opacity: 0.8, direction: "ltr", textAlign: "right" }}>
          {p.lifeXp.toLocaleString()} / {p.nextLevelXp.toLocaleString()} XP
        </div>
      </div>
    </div>
  );
}

function LifeProgress({ s }: { s: LifeOSSnapshot }) {
  return (
    <div className="gp" style={{ padding: 12 }}>
      <h4>התקדמות מטרות החיים</h4>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Ring value={overallProgress(s.domainProgress)} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", columnGap: 10, rowGap: 2, fontSize: 12, flex: 1 }}>
          {DISTRICTS.map((d) => (
            <div key={d.id} style={{ display: "contents" }}>
              <span>
                <span style={{ color: d.accent }}>●</span> {LABEL[d.id]}
              </span>
              <b>{pct(s.domainProgress[d.id])}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NextGoalCard({ s }: { s: LifeOSSnapshot }) {
  const g = nextGoal(s.goals);
  if (!g) return null;
  const d = districtOf(g.region);
  const days = Math.max(0, Math.round((new Date(g.targetDate).getTime() - Date.now()) / 864e5));
  return (
    <div className="gp" style={{ padding: 12 }}>
      <h4>🎯 המטרה הבאה שלך</h4>
      <div style={{ color: d.accent, fontWeight: 700, fontSize: 14 }}>{g.title}</div>
      <div style={{ fontSize: 12, opacity: 0.8 }}>
        {d.name} · עוד {days} ימים
      </div>
      <div className="bar" style={{ marginTop: 6 }}>
        <i style={{ width: pct(g.progress), background: d.accent, marginInlineStart: "auto" }} />
      </div>
    </div>
  );
}

function Tasks({ s }: { s: LifeOSSnapshot }) {
  const today = new Date().toISOString().slice(0, 10);
  const list = s.tasks.filter((t) => t.status === "planned" && (t.date ?? today) <= today);
  return (
    <div className="gp" style={{ padding: 12 }}>
      <h4>
        משימות פעילות ({list.length})<span className="chip">מ־LifeOS · קריאה בלבד</span>
      </h4>
      {list.map((t) => (
        <div key={t.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, padding: "2px 0" }}>
          <span style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${t.region ? districtOf(t.region).accent : "#888"}`, flex: "none" }} />
          {t.title}
        </div>
      ))}
      <div style={{ fontSize: 11, opacity: 0.65, marginTop: 4 }}>השלמה ואימות מתבצעים באפליקציית LifeOS.</div>
    </div>
  );
}

function Districts({ s }: { s: LifeOSSnapshot }) {
  const set = useProto((st) => st.set);
  return (
    <div className="gp" style={{ padding: 12 }}>
      <h4>✦ 6 רובעי חיים</h4>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
        {DISTRICTS.map((d) => {
          const st = developmentStage(s.domainProgress[d.id]);
          return (
            <button key={d.id} className="tile" onClick={() => set({ panel: `district:${d.id}` })} style={{ borderColor: d.accent + (st.level >= 2 ? "cc" : "66") }}>
              <div style={{ fontSize: 18 }}>
                {ICON[d.id]}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{d.name.replace("רובע ה", "")}</div>
              <div className="bar" style={{ marginTop: 4, height: 5 }}>
                <i style={{ width: pct(s.domainProgress[d.id]), background: d.accent, marginInlineStart: "auto" }} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function useLocation() {
  const [loc, setLoc] = useState(() => locate(telemetry.x, telemetry.z));
  useEffect(() => {
    const t = setInterval(() => setLoc(locate(telemetry.x, telemetry.z)), 400);
    return () => clearInterval(t);
  }, []);
  return loc;
}

function LocationCard({ s }: { s: LifeOSSnapshot }) {
  const loc = useLocation();
  const set = useProto((st) => st.set);
  const title = loc.kind === "plaza" ? "הכיכר המרכזית" : loc.kind === "tower" ? "מגדל LifeOS" : loc.kind === "avenue" ? loc.district.name : "רחובות העיר";
  const sub =
    loc.kind === "plaza"
      ? "לב העיר. שש שדרות מובילות לששת רובעי החיים."
      : loc.kind === "tower"
        ? "המטה של החיים שלך: סקירה, מטרות והתקדמות."
        : loc.kind === "avenue"
          ? `${loc.district.subtitle} · ${pct(s.domainProgress[loc.district.id])}`
          : "";
  const action = loc.kind === "avenue" ? () => set({ panel: `district:${loc.district.id}` }) : loc.kind === "tower" ? () => set({ panel: "overview" }) : () => set({ panel: "map" });
  return (
    <div className="gp" style={{ padding: 12 }} data-testid="location">
      <div style={{ fontSize: 11, opacity: 0.75 }}>📍 מיקום נוכחי</div>
      <div style={{ fontWeight: 800, fontSize: 17 }}>{title}</div>
      <div style={{ fontSize: 12, opacity: 0.8, minHeight: 16 }}>{sub}</div>
      <button onClick={action} style={{ marginTop: 8, width: "100%", border: "none", borderRadius: 12, padding: "9px 0", fontWeight: 700, color: "#fff", background: "linear-gradient(90deg,#2563eb,#3b82f6)", cursor: "pointer", pointerEvents: "auto" }}>
        {loc.kind === "plaza" ? "מפת העיר" : "פרטים"} ›
      </button>
    </div>
  );
}

function WorldProgressCard({ s }: { s: LifeOSSnapshot }) {
  const next = s.milestones.find((m) => !m.done);
  return (
    <div className="gp" style={{ padding: 12, background: "linear-gradient(120deg,rgba(76,29,149,.85),rgba(30,27,75,.85))", borderColor: "rgba(250,204,21,.5)" }}>
      <h4>
        🏗️ התקדמות העולם<span className="chip">משחקי · לא Life XP</span>
      </h4>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
        <span>בניית העיר</span>
        <b>{pct(s.world.cityConstruction)}</b>
      </div>
      <div className="bar" style={{ margin: "4px 0 6px" }}>
        <i style={{ width: pct(s.world.cityConstruction), background: "#facc15", marginInlineStart: "auto" }} />
      </div>
      <div style={{ fontSize: 12, opacity: 0.85 }}>
        {s.world.unlockedBuildings.length} מבנים נפתחו · {s.world.discoveries.length} גילויים · {s.world.points} נק׳ עולם
      </div>
      {next && <div style={{ fontSize: 12, marginTop: 4, color: "#fde68a" }}>הבא: {next.unlocks} ← {next.title}</div>}
    </div>
  );
}

/** Top-down minimap, heading-up, drawn from the shared city layout. */
function MiniMap({ s, size = 150 }: { s: LifeOSSnapshot; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 100) return;
      last = t;
      const c = ref.current;
      if (!c) return;
      const g = c.getContext("2d")!;
      const dpr = Math.min(2, devicePixelRatio || 1);
      if (c.width !== size * dpr) c.width = c.height = size * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, size, size);
      g.save();
      g.beginPath();
      g.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = "rgba(12,18,30,.9)";
      g.fillRect(0, 0, size, size);
      const scale = size / 120; // metres -> px (60 m radius visible)
      g.translate(size / 2, size / 2);
      g.rotate(-telemetry.camYaw + Math.PI); // camera heading up
      g.scale(scale, scale);
      g.translate(-telemetry.x, -telemetry.z);
      // avenues
      for (const d of DISTRICTS) {
        const v = dirOf(d.bearing);
        g.strokeStyle = d.accent;
        g.lineWidth = AVENUE.w;
        g.globalAlpha = 0.55;
        g.beginPath();
        g.moveTo(v.x * PLAZA.r, v.z * PLAZA.r);
        g.lineTo(v.x * AVENUE.endR, v.z * AVENUE.endR);
        g.stroke();
        g.globalAlpha = 1;
        const gp = gatePos(d);
        g.fillStyle = d.accent;
        g.beginPath();
        g.arc(gp.x, gp.z, 2.4, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = "rgba(200,210,225,.25)";
      g.beginPath();
      g.arc(0, 0, PLAZA.r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#4fc3ff";
      g.beginPath();
      g.arc(0, 0, 4, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(79,195,255,.7)";
      g.fillRect(TOWER.x - TOWER.w / 2, TOWER.z - TOWER.d / 2, TOWER.w, TOWER.d);
      g.restore();
      // player arrow (always points up = camera heading; rotated by facing relative to camera)
      g.save();
      g.translate(size / 2, size / 2);
      g.rotate(-(telemetry.yaw - telemetry.camYaw + Math.PI));
      g.fillStyle = "#c4b5fd";
      g.beginPath();
      g.moveTo(0, -9);
      g.lineTo(6, 6);
      g.lineTo(0, 3);
      g.lineTo(-6, 6);
      g.closePath();
      g.fill();
      g.restore();
      g.strokeStyle = "rgba(255,255,255,.3)";
      g.lineWidth = 2;
      g.beginPath();
      g.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
      g.stroke();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [s, size]);
  return <canvas ref={ref} style={{ width: size, height: size, display: "block" }} data-testid="minimap" />;
}

function BottomBar() {
  const set = useProto((st) => st.set);
  const items: [string, string, string][] = [
    ["inventory", "🎒", "מלאי"],
    ["achievements", "🏆", "הישגים"],
    ["map", "🌐", "מפת העולם"],
  ];
  return (
    <div style={{ display: "flex", gap: 14 }}>
      {items.map(([k, i, l]) => (
        <button key={k} className="btm" onClick={() => set({ panel: k })}>
          <span>{i}</span>
          {l}
        </button>
      ))}
      <AetheriaButton />
    </div>
  );
}

/** Passage to the fantasy layer (shown only where an AETHERIA world is available). */
function AetheriaButton({ compact }: { compact?: boolean }) {
  if (!worldAvailable("sanctuary")) return null;
  const go = () => void goToWorld("sanctuary", { style: "resonance" });
  return compact ? (
    <button className="gp" onClick={go} data-testid="to-aetheria" style={{ height: 42, padding: "0 12px", borderRadius: 21, color: "#e9c987", fontSize: 13, fontWeight: 700 }}>
      ✦ AETHERIA
    </button>
  ) : (
    <button className="btm" onClick={go} data-testid="to-aetheria">
      <span style={{ color: "#e9c987" }}>✦</span>
      AETHERIA
    </button>
  );
}

function DistrictPanel({ d, s }: { d: DistrictDef; s: LifeOSSnapshot }) {
  const goals = s.goals.filter((g) => g.region === d.id);
  const ms = s.milestones.filter((m) => m.region === d.id);
  const st = developmentStage(s.domainProgress[d.id]);
  return (
    <>
      <h3 style={{ margin: "0 0 4px", color: d.accent }}>
        {ICON[d.id]} {d.name}
      </h3>
      <div style={{ fontSize: 13, opacity: 0.8 }}>{d.subtitle}</div>
      <div style={{ margin: "10px 0", display: "flex", alignItems: "center", gap: 12 }}>
        <Ring value={s.domainProgress[d.id]} color={d.accent} />
        <div style={{ fontSize: 13 }}>שלב פיתוח: <b>{st.label}</b>. הרובע תמיד פתוח; ההתקדמות בחיים משנה את המראה שלו, לא את הגישה אליו.</div>
      </div>
      <b style={{ fontSize: 13 }}>מטרות נוכחיות</b>
      {goals.length === 0 && <div style={{ fontSize: 13, opacity: 0.7 }}>אין מטרות פעילות בתחום.</div>}
      {goals.map((g) => (
        <div key={g.id} style={{ fontSize: 13, margin: "4px 0" }}>
          {g.title} · {pct(g.progress)}
          <div className="bar" style={{ height: 5 }}>
            <i style={{ width: pct(g.progress), background: d.accent, marginInlineStart: "auto" }} />
          </div>
        </div>
      ))}
      <b style={{ fontSize: 13, display: "block", marginTop: 8 }}>אבני דרך</b>
      {ms.map((m) => (
        <div key={m.id} style={{ fontSize: 13 }}>
          {m.done ? "✅" : "⏳"} {m.title} <span style={{ opacity: 0.7 }}>→ {m.unlocks}</span>
        </div>
      ))}
      {ms.length === 0 && <div style={{ fontSize: 13, opacity: 0.7 }}>אין אבני דרך קרובות.</div>}
    </>
  );
}

function Panel({ s }: { s: LifeOSSnapshot }) {
  const panel = useProto((st) => st.panel);
  const set = useProto((st) => st.set);
  if (!panel) return null;
  const close = () => set({ panel: null });
  let body: React.ReactNode = null;
  if (panel.startsWith("district:")) body = <DistrictPanel d={districtOf(panel.slice(9) as Domain)} s={s} />;
  else if (panel === "overview")
    body = (
      <>
        <h3 style={{ marginTop: 0 }}>סקירת החיים שלך</h3>
        <LifeProgress s={s} />
        <div style={{ height: 8 }} />
        <NextGoalCard s={s} />
        <div style={{ height: 8 }} />
        <WorldProgressCard s={s} />
      </>
    );
  else if (panel === "achievements")
    body = (
      <>
        <h3 style={{ marginTop: 0 }}>🏆 הישגים</h3>
        <b style={{ fontSize: 13 }}>אבני דרך שאומתו ב־LifeOS</b>
        {s.milestones.filter((m) => m.done).map((m) => (
          <div key={m.id} style={{ fontSize: 13 }}>
            ✅ {m.title} · {districtOf(m.region).name}
          </div>
        ))}
        <b style={{ fontSize: 13, display: "block", marginTop: 8 }}>הישגי עולם (משחקיים)</b>
        {s.world.achievements.map((a) => (
          <div key={a.id} style={{ fontSize: 13 }}>
            ⭐ {a.title}
          </div>
        ))}
      </>
    );
  else if (panel === "inventory")
    body = (
      <>
        <h3 style={{ marginTop: 0 }}>🎒 מלאי</h3>
        <div style={{ fontSize: 13 }}>מבנים שנפתחו: {s.world.unlockedBuildings.join(" · ")}</div>
        <div style={{ fontSize: 13 }}>גילויים: {s.world.discoveries.join(" · ")}</div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>פריטים קוסמטיים יתווספו בשלב הבא. לא משפיעים על Life XP.</div>
      </>
    );
  else if (panel === "map")
    body = (
      <>
        <h3 style={{ marginTop: 0 }}>🌐 מפת העיר</h3>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 12, alignItems: "center" }}>
          <MiniMap s={s} size={180} />
          <div style={{ fontSize: 13 }}>
            {DISTRICTS.map((d) => (
              <div key={d.id}>
                <span style={{ color: d.accent }}>●</span> {d.name} · {pct(s.domainProgress[d.id])} · {developmentStage(s.domainProgress[d.id]).label}
              </div>
            ))}
          </div>
        </div>
      </>
    );
  return (
    <div className="modal" onClick={close} data-testid="panel">
      <div className="gp" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={close}>
          ✕
        </button>
        {body}
        <div style={{ fontSize: 11, opacity: 0.6, marginTop: 10 }}>{s.source === "mock" ? "נתוני דמו (Mock). חיבור לנתוני LifeOS אמיתיים: אחרי אישור האב־טיפוס." : "נתונים מ־LifeOS · תצוגה בלבד. השלמה ואימות רק באפליקציה."}</div>
      </div>
    </div>
  );
}

function Settings() {
  const [open, setOpen] = useState(false);
  const debug = useProto((s) => s.debug);
  const quality = useProto((s) => s.quality);
  const avatar = useProto((s) => s.avatar);
  const set = useProto((s) => s.set);
  return (
    <div style={{ position: "relative" }}>
      <button className="gp" style={{ width: 42, height: 42, borderRadius: "50%", color: "#fff", fontSize: 18, cursor: "pointer" }} onClick={() => setOpen((o) => !o)} data-testid="settings">
        ⚙
      </button>
      {open && (
        <div className="gp" style={{ position: "absolute", top: 48, left: 0, width: 250, padding: 10, fontSize: 12, display: "grid", gap: 5 }}>
          <div>דמות: {avatar?.label ?? "…"}</div>
          <WorldSwitcher />
          <label>
            איכות{" "}
            <select value={quality} onChange={(e) => set({ quality: e.target.value as typeof quality })}>
              <option value="high">גבוהה</option>
              <option value="medium">בינונית</option>
              <option value="low">נמוכה</option>
            </select>
          </label>
          <label>
            <input type="checkbox" checked={debug.rootMotionStops} onChange={(e) => set({ debug: { ...debug, rootMotionStops: e.target.checked } })} /> עצירה עם Root Motion
          </label>
          <label>
            <input type="checkbox" checked={debug.showColliders} onChange={(e) => set({ debug: { ...debug, showColliders: e.target.checked } })} /> הצג מתנגשים
          </label>
          {DEMO_EVENTS && <button onClick={emitMockCorrection}>שלח אירוע תיקון (דמו)</button>}
        </div>
      )}
    </div>
  );
}

function Prompt({ touch }: { touch: boolean }) {
  const prompt = useProto((s) => s.prompt);
  if (!prompt) return null;
  return (
    <div className="gp" data-testid="prompt" style={{ position: "absolute", left: "50%", bottom: touch ? 180 : 110, transform: "translateX(-50%)", padding: "8px 14px", fontSize: 14, whiteSpace: "nowrap" }}>
      {touch ? "״פעולה״" : "E"} — {prompt}
    </div>
  );
}

function Feed() {
  const reactions = useProto((s) => s.reactions);
  if (!reactions.length) return null;
  return (
    <div className="gp" style={{ padding: "6px 10px", fontSize: 12, maxWidth: 260 }}>
      {reactions.slice(0, 2).map((r) => (
        <div key={r.eventId}>
          {r.kind === "revert" ? "↩" : "✓"} {r.label} <span className="chip">דמו</span>
        </div>
      ))}
    </div>
  );
}

export function GameHud({ touch }: { touch: boolean }) {
  const s = useProto((st) => st.snapshot);
  const [drawer, setDrawer] = useState(false);
  const narrow = typeof window !== "undefined" && window.innerWidth < 900;
  if (!s) return null;
  return (
    <div className="hud">
      <style>{CSS}</style>
      {!narrow ? (
        <>
          <div style={{ position: "absolute", top: 14, right: 14, width: 300, display: "grid", gap: 10 }}>
            <Profile s={s} />
            <LifeProgress s={s} />
            <NextGoalCard s={s} />
            <Tasks s={s} />
          </div>
          <div style={{ position: "absolute", top: 14, left: 14, width: 330, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Settings />
              <span className="gp" style={{ padding: "6px 12px", fontSize: 12 }}>
                🏗️ {s.world.points} נק׳ עולם <span className="chip">משחקי</span>
              </span>
            </div>
            <Districts s={s} />
            <LocationCard s={s} />
          </div>
          <div style={{ position: "absolute", bottom: 14, right: 14 }} className="gp">
            <MiniMap s={s} />
          </div>
          <div style={{ position: "absolute", bottom: 16, left: 14, display: "grid", gap: 10, justifyItems: "start" }}>
            <div style={{ width: 330 }}>
              <WorldProgressCard s={s} />
            </div>
            <BottomBar />
          </div>
          <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)" }}>
            <Feed />
          </div>
        </>
      ) : (
        <>
          <div style={{ position: "absolute", top: 8, right: 8, left: 8, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <Profile s={s} compact />
            <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
              <div style={{ display: "flex", gap: 6 }}>
                <AetheriaButton compact />
                <button className="gp" style={{ width: 42, height: 42, borderRadius: "50%", color: "#fff", fontSize: 18 }} onClick={() => setDrawer((o) => !o)} data-testid="drawer">
                  ☰
                </button>
                <Settings />
              </div>
              <div className="gp" style={{ borderRadius: "50%" }}>
                <MiniMap s={s} size={96} />
              </div>
            </div>
          </div>
          <div style={{ position: "absolute", top: 64, right: 8, maxWidth: "60vw" }}>
            <Feed />
          </div>
          {drawer && (
            <div style={{ position: "absolute", top: 60, right: 8, left: 8, bottom: 190, overflow: "auto", display: "grid", gap: 8, alignContent: "start", pointerEvents: "auto" }}>
              <LifeProgress s={s} />
              <NextGoalCard s={s} />
              <Tasks s={s} />
              <Districts s={s} />
              <LocationCard s={s} />
              <WorldProgressCard s={s} />
              <div style={{ display: "flex", justifyContent: "center" }}>
                <BottomBar />
              </div>
            </div>
          )}
        </>
      )}
      {s.source === "mock" && (
        <div data-testid="demo-badge" style={{ position: "absolute", top: narrow ? 108 : 14, left: "50%", transform: "translateX(-50%)", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 10, background: "rgba(250,204,21,.18)", border: "1px solid rgba(250,204,21,.5)", color: "#fde68a" }}>
          מצב הדגמה · נתונים לדוגמה
        </div>
      )}
      <Prompt touch={touch} />
      <Panel s={s} />
      {touch && (
        <div style={{ pointerEvents: "auto" }}>
          <Stick />
          <ActionButtons />
        </div>
      )}
    </div>
  );
}
