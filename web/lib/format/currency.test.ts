import { describe, expect, it } from "vitest";

import {
  formatAgorot,
  formatCurrency,
  formatNumber,
  formatSignedPercent,
  formatUnitPrice,
} from "./currency";

describe("formatCurrency (spec §23)", () => {
  it("puts the shekel sign BEFORE the number", () => {
    // Intl's own he-IL currency style produces "12,394 ₪" with the symbol
    // after the number, which the spec explicitly rules out. This is the
    // regression guard for that.
    expect(formatCurrency(12394, true)).toBe("₪12,394");
    expect(formatCurrency(34.5)).toBe("₪34.50");
  });

  it("never renders the forbidden shapes", () => {
    for (const value of [0, 1, 34.5, 12394, 1234567.89]) {
      const formatted = formatCurrency(value);
      expect(formatted.startsWith("₪")).toBe(true);
      expect(formatted.endsWith("₪")).toBe(false);
      expect(formatted).not.toContain("NIS");
      // No embedded directional marks, which Intl's currency style inserts.
      expect(formatted).not.toMatch(/[‎‏]/);
    }
  });

  it("groups thousands and keeps two decimals by default", () => {
    expect(formatCurrency(1234567.891)).toBe("₪1,234,567.89");
    expect(formatCurrency(1000)).toBe("₪1,000.00");
  });

  it("drops the agorot for headline figures", () => {
    expect(formatCurrency(12840.75, true)).toBe("₪12,841");
  });

  it("keeps the minus sign outside the symbol", () => {
    expect(formatCurrency(-34.5)).toBe("-₪34.50");
  });

  it("formats zero without a sign", () => {
    expect(formatCurrency(0)).toBe("₪0.00");
    expect(formatCurrency(0, true)).toBe("₪0");
  });
});

describe("formatAgorot", () => {
  it("converts integer minor units to shekels", () => {
    expect(formatAgorot(1234)).toBe("₪12.34");
    expect(formatAgorot(1239400, true)).toBe("₪12,394");
  });
});

describe("formatSignedPercent", () => {
  it("signs a rise and a fall", () => {
    expect(formatSignedPercent(0.101)).toBe("+10.1%");
    expect(formatSignedPercent(-0.05)).toBe("-5.0%");
    expect(formatSignedPercent(0)).toBe("0.0%");
  });
});

describe("formatNumber", () => {
  it("groups thousands", () => {
    expect(formatNumber(12394)).toBe("12,394");
  });
});

describe("formatUnitPrice", () => {
  it("reads naturally in Hebrew", () => {
    expect(formatUnitPrice(109, "ק״ג")).toBe("₪109.00 לק״ג");
  });
});
