/** World transition overlay + a small world switcher (settings). */
import { useWorlds } from "../engine/worldStore";
import { listWorlds } from "../worlds/registry";

export function TransitionOverlay() {
  const phase = useWorlds((s) => s.phase);
  const style = useWorlds((s) => s.style);
  const ms = useWorlds((s) => s.durationMs);
  const visible = phase === "out";
  const bg = style === "resonance" ? "radial-gradient(circle at 50% 55%, #fff6d8 0%, #9fd8ff 35%, #0b1020 85%)" : "#05070c";
  return (
    <div
      data-testid="transition"
      data-phase={phase}
      style={{ position: "absolute", inset: 0, background: bg, opacity: visible ? 1 : 0, transition: `opacity ${ms}ms ease`, pointerEvents: phase === "idle" ? "none" : "auto", zIndex: 20 }}
    />
  );
}

export function WorldSwitcher() {
  const current = useWorlds((s) => s.current);
  const transitionTo = useWorlds((s) => s.transitionTo);
  const worlds = listWorlds();
  if (worlds.length < 2) return null;
  return (
    <label style={{ fontSize: 12 }}>
      עולם{" "}
      <select value={current} onChange={(e) => transitionTo(e.target.value)} data-testid="world-switch">
        {worlds.map((w) => (
          <option key={w.id} value={w.id}>
            {w.title}
          </option>
        ))}
      </select>
    </label>
  );
}
