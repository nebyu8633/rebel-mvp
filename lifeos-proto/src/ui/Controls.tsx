/** Touch + mouse controls: virtual stick (bottom-left), drag-to-look anywhere else, action buttons. */
import { useEffect, useRef, useState } from "react";
import { input } from "../player/input";
import { useProto } from "../store";

const R = 56;

export function Stick() {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0, on: false });
  const id = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const onDown = (e: React.PointerEvent) => {
    id.current = e.pointerId;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const r = base.current!.getBoundingClientRect();
    origin.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    onMove(e);
  };
  const onMove = (e: React.PointerEvent) => {
    if (id.current !== e.pointerId) return;
    let dx = e.clientX - origin.current.x;
    let dy = e.clientY - origin.current.y;
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    input.stickActive = true;
    input.stickX = dx / R;
    input.stickY = -dy / R;
    setKnob({ x: dx, y: dy, on: true });
  };
  const onUp = (e: React.PointerEvent) => {
    if (id.current !== e.pointerId) return;
    id.current = null;
    input.stickActive = false;
    input.stickX = input.stickY = 0;
    setKnob({ x: 0, y: 0, on: false });
  };
  return (
    <div
      ref={base}
      data-testid="stick"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      style={{ position: "absolute", left: 22, bottom: 26, width: R * 2 + 24, height: R * 2 + 24, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)", touchAction: "none" }}
    >
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 54, height: 54, marginLeft: -27, marginTop: -27, borderRadius: "50%", background: knob.on ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.3)", transform: `translate(${knob.x}px, ${knob.y}px)`, pointerEvents: "none" }} />
    </div>
  );
}

/** Drag anywhere on the 3D view to orbit the camera (mouse or touch). */
export function useLookDrag(el: HTMLElement | null) {
  useEffect(() => {
    if (!el) return;
    const ptrs = new Map<number, { x: number; y: number }>();
    const down = (e: PointerEvent) => {
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      const p = ptrs.get(e.pointerId);
      if (!p) return;
      input.lookDX += e.clientX - p.x;
      input.lookDY += e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
    };
    const up = (e: PointerEvent) => ptrs.delete(e.pointerId);
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [el]);
}

const btn: React.CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: "50%",
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(15,20,28,0.55)",
  color: "#fff",
  fontSize: 13,
  fontWeight: 600,
  touchAction: "none",
};

export function ActionButtons() {
  const prompt = useProto((s) => s.prompt);
  const [run, setRun] = useState(false);
  const press = (k: "jump" | "interact" | "gesture") => (e: React.PointerEvent) => {
    e.preventDefault();
    input[k] = true;
  };
  return (
    <div style={{ position: "absolute", right: 18, bottom: 24, display: "grid", gridTemplateColumns: "64px 64px", gap: 12 }}>
      <button style={{ ...btn, opacity: prompt ? 1 : 0.35 }} onPointerDown={press("interact")} data-testid="btn-interact">
        פעולה
      </button>
      <button style={btn} onPointerDown={press("jump")} data-testid="btn-jump">
        קפיצה
      </button>
      <button style={btn} onPointerDown={press("gesture")}>
        נפנוף
      </button>
      <button
        style={{ ...btn, background: run ? "rgba(63,182,255,0.55)" : btn.background }}
        onPointerDown={(e) => {
          e.preventDefault();
          input.run = !input.run;
          setRun(input.run);
        }}
      >
        ריצה
      </button>
    </div>
  );
}
