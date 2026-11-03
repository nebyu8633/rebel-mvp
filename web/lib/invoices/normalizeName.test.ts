import { describe, expect, it } from "vitest";

import { normalizeName } from "./normalizeName";

describe("normalizeName", () => {
  it("collapses formatting differences that are not real differences", () => {
    expect(normalizeName("  בשר   הצפון  ")).toBe(normalizeName("בשר הצפון"));
    expect(normalizeName("Meat Co.")).toBe("meat co");
    expect(normalizeName("CHICKEN BREAST")).toBe("chicken breast");
  });

  it("treats Hebrew abbreviation punctuation as noise", () => {
    // ק"ג / ק״ג / קג are the same unit written three ways.
    expect(normalizeName('חזה עוף 5 ק"ג')).toBe(normalizeName("חזה עוף 5 ק״ג"));
  });

  it("strips niqqud", () => {
    expect(normalizeName("בָּשָׂר")).toBe(normalizeName("בשר"));
  });

  it("does NOT merge different word orders", () => {
    // Conservative by design: reordering is a guess, and a wrong guess here
    // produces a fabricated price change.
    expect(normalizeName('חזה עוף 5 ק"ג')).not.toBe(normalizeName("עוף חזה 5KG"));
  });

  it("does NOT merge different specifications", () => {
    expect(normalizeName("חזה עוף טרי")).not.toBe(normalizeName("חזה עוף קפוא"));
    expect(normalizeName("חזה עוף")).not.toBe(normalizeName("חזה עוף טרי"));
  });

  it("is idempotent", () => {
    const once = normalizeName('אנטריקוט טרי מיוחד 2 ק"ג');
    expect(normalizeName(once)).toBe(once);
  });
});
