import { describe, expect, it } from "vitest";

import {
  MAX_FILES_PER_ANALYSIS,
  MAX_FILE_SIZE_BYTES,
  formatFileSize,
  sniffMimeType,
  validateFile,
} from "./validateFile";

const validPdf = { name: "invoice.pdf", size: 1024 * 500, type: "application/pdf" };

describe("validateFile", () => {
  it("accepts the supported formats", () => {
    expect(validateFile(validPdf).ok).toBe(true);
    expect(validateFile({ name: "a.jpg", size: 1000, type: "image/jpeg" }).ok).toBe(true);
    expect(validateFile({ name: "a.png", size: 1000, type: "image/png" }).ok).toBe(true);
  });

  it("rejects a file over the size cap", () => {
    const result = validateFile({ ...validPdf, size: MAX_FILE_SIZE_BYTES + 1 });
    expect(result).toEqual({ ok: false, errorKey: "tooLarge" });
  });

  it("accepts a file exactly at the cap", () => {
    expect(validateFile({ ...validPdf, size: MAX_FILE_SIZE_BYTES }).ok).toBe(true);
  });

  it("rejects an empty file", () => {
    expect(validateFile({ ...validPdf, size: 0 })).toEqual({ ok: false, errorKey: "empty" });
  });

  it("rejects an unsupported type", () => {
    expect(validateFile({ name: "a.docx", size: 1000, type: "application/msword" })).toEqual({
      ok: false,
      errorKey: "wrongType",
    });
  });

  it("rejects executables even when they claim to be a PDF", () => {
    // A renamed binary can declare any MIME type, so the extension is checked
    // independently and first.
    expect(validateFile({ name: "payload.exe", size: 1000, type: "application/pdf" })).toEqual({
      ok: false,
      errorKey: "executable",
    });
    expect(validateFile({ name: "script.sh", size: 1000, type: "image/png" })).toEqual({
      ok: false,
      errorKey: "executable",
    });
  });

  it("is case-insensitive about extensions", () => {
    expect(validateFile({ name: "PAYLOAD.EXE", size: 1000, type: "application/pdf" })).toEqual({
      ok: false,
      errorKey: "executable",
    });
  });

  it("enforces the per-analysis file cap", () => {
    expect(validateFile(validPdf, MAX_FILES_PER_ANALYSIS - 1).ok).toBe(true);
    expect(validateFile(validPdf, MAX_FILES_PER_ANALYSIS)).toEqual({
      ok: false,
      errorKey: "tooMany",
    });
  });
});

describe("sniffMimeType", () => {
  it("recognizes real file signatures", () => {
    expect(sniffMimeType(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe(
      "application/pdf",
    );
    expect(sniffMimeType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(
      sniffMimeType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe("image/png");
  });

  it("returns null for content that is not a supported document", () => {
    // A file claiming to be a PDF whose bytes say otherwise must not pass.
    expect(sniffMimeType(new Uint8Array([0x4d, 0x5a, 0x90, 0x00]))).toBeNull();
    expect(sniffMimeType(new Uint8Array([]))).toBeNull();
  });
});

describe("formatFileSize", () => {
  it("scales the unit to the size", () => {
    expect(formatFileSize(500)).toBe("500B");
    expect(formatFileSize(2048)).toBe("2KB");
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe("2.5MB");
  });
});
