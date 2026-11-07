/**
 * WebGL context loss (iOS reclaims GPU memory under pressure or after backgrounding): without this
 * the game stays a black screen. Inside the Canvas: <ContextLossProbe/> listens on the canvas.
 * Outside: <ContextLossOverlay/> explains and offers a resume (progress is saved, so a reload is safe).
 */
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { create } from "zustand";

export const useGpu = create<{ lost: boolean; set: (lost: boolean) => void }>((set) => ({ lost: false, set: (lost) => set({ lost }) }));

export function ContextLossProbe({ beforeReload }: { beforeReload?: () => void | Promise<void> }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement;
    const lost = (e: Event) => {
      e.preventDefault(); // allow the browser to restore the context
      useGpu.getState().set(true);
      void beforeReload?.();
    };
    const restored = () => useGpu.getState().set(false);
    el.addEventListener("webglcontextlost", lost);
    el.addEventListener("webglcontextrestored", restored);
    return () => {
      el.removeEventListener("webglcontextlost", lost);
      el.removeEventListener("webglcontextrestored", restored);
    };
  }, [gl, beforeReload]);
  return null;
}

export function ContextLossOverlay() {
  const lost = useGpu((s) => s.lost);
  if (!lost) return null;
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 30, display: "grid", placeItems: "center", background: "rgba(5,7,12,.85)", color: "#f3ead7", direction: "rtl", textAlign: "center", padding: 24 }} data-testid="gpu-lost">
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>העולם הושהה</div>
        <div style={{ fontSize: 14, opacity: 0.85, marginBottom: 14 }}>המכשיר שחרר את זיכרון הגרפיקה. ההתקדמות שלך שמורה.</div>
        <button onClick={() => location.reload()} style={{ padding: "10px 18px", borderRadius: 12, border: "1px solid rgba(214,180,110,.5)", background: "rgba(20,18,30,.85)", color: "#f3ead7", fontSize: 15 }}>
          המשך
        </button>
      </div>
    </div>
  );
}
