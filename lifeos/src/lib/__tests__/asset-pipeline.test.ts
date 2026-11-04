import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("hero asset pipeline", () => {
  it("merges per-clip GLBs onto one skeleton, compresses, and reports the budget", { timeout: 60000 }, () => {
    const dir = mkdtempSync(join(tmpdir(), "hero-"));
    execFileSync("node", ["scripts/assets/make-test-hero.mjs", dir]);
    execFileSync("node", ["scripts/assets/prepare-hero.mjs", "--hero", "t", "--clip", `idle=${dir}/test-idle.glb`, "--clip", `run=${dir}/test-run.glb`, "--clip", `attack=${dir}/test-attack.glb`, "--out", dir, "--max-tris", "60"]);
    const r = JSON.parse(readFileSync(join(dir, "t.report.json"), "utf8"));
    expect(r.clips.map((c: { name: string }) => c.name)).toEqual(["idle", "run", "attack"]);
    expect(r.bones).toBe(7);
    expect(r.triangles.after).toBeLessThanOrEqual(r.triangles.before);
    expect(r.bytes).toBeGreaterThan(1000);
    // the meshopt extension is required by the output (decoded in the browser)
    const json = readFileSync(join(dir, "t.glb")).subarray(20, 20 + 4000).toString("utf8");
    expect(json).toContain("EXT_meshopt_compression");
  });
  it("refuses a clip whose skeleton doesn't match (different bone names)", { timeout: 60000 }, () => {
    const a = mkdtempSync(join(tmpdir(), "hero-"));
    const b = mkdtempSync(join(tmpdir(), "hero-"));
    execFileSync("node", ["scripts/assets/make-test-hero.mjs", a]);
    execFileSync("node", ["scripts/assets/make-test-hero.mjs", b, "Other_"]);
    let err = "";
    try {
      execFileSync("node", ["scripts/assets/prepare-hero.mjs", "--hero", "bad", "--clip", `idle=${a}/test-idle.glb`, "--clip", `run=${b}/test-run.glb`, "--out", a], { stdio: "pipe" });
    } catch (e) {
      err = String((e as { stderr?: Buffer }).stderr ?? e);
    }
    expect(err).toContain("bone names differ");
  });
  it("reads already-compressed GLBs as input", { timeout: 60000 }, () => {
    const dir = mkdtempSync(join(tmpdir(), "hero-"));
    execFileSync("node", ["scripts/assets/make-test-hero.mjs", dir]);
    execFileSync("node", ["scripts/assets/prepare-hero.mjs", "--hero", "c1", "--clip", `idle=${dir}/test-idle.glb`, "--out", dir]);
    execFileSync("node", ["scripts/assets/prepare-hero.mjs", "--hero", "c2", "--clip", `idle=${dir}/c1.glb`, "--clip", `run=${dir}/test-run.glb`, "--out", dir]);
    const r = JSON.parse(readFileSync(join(dir, "c2.report.json"), "utf8"));
    expect(r.clips.map((c: { name: string }) => c.name)).toEqual(["idle", "run"]);
  });
});
