import { describe, expect, it } from "vitest";

import { invoiceObjectPath, sanitizeFileName } from "./storage";

describe("sanitizeFileName", () => {
  it("keeps Hebrew filenames and their spaces intact", () => {
    // Mangling these would make the invoice list unreadable for the user.
    expect(sanitizeFileName("חשבונית ספק.pdf")).toBe("חשבונית ספק.pdf");
    expect(sanitizeFileName("בשר הצפון - מרץ.pdf")).toBe("בשר הצפון - מרץ.pdf");
  });

  it("strips path traversal down to the final segment", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("a/b/c.pdf")).toBe("c.pdf");
    expect(sanitizeFileName("..\\..\\windows\\system32")).toBe("system32");
  });

  it("falls back to a default when nothing usable remains", () => {
    expect(sanitizeFileName("..")).toBe("invoice");
    expect(sanitizeFileName("")).toBe("invoice");
    expect(sanitizeFileName("///")).toBe("invoice");
  });

  it("removes characters that are illegal in an object key", () => {
    expect(sanitizeFileName('in<>:"|?*voice.pdf')).toBe("invoice.pdf");
  });

  it("caps the length", () => {
    expect(sanitizeFileName(`${"a".repeat(300)}.pdf`).length).toBe(120);
  });
});

describe("invoiceObjectPath", () => {
  it("puts the business id first, which is what the storage policy checks", () => {
    const path = invoiceObjectPath("biz-123", "inv-456", "חשבונית.pdf");
    expect(path).toBe("biz-123/inv-456/חשבונית.pdf");
    expect(path.split("/")[0]).toBe("biz-123");
  });

  it("cannot be escaped by a crafted filename", () => {
    const path = invoiceObjectPath("biz-123", "inv-456", "../../other-business/x.pdf");
    expect(path.split("/")[0]).toBe("biz-123");
    expect(path).not.toContain("..");
  });
});
