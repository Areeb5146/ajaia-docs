import { describe, expect, it } from "vitest";
import {
  baseName,
  ImportError,
  isSupported,
  MAX_UPLOAD_BYTES,
  parseUpload,
} from "@/lib/import";
import { docToPlainText, isValidDoc } from "@/lib/doc";

describe("upload gating", () => {
  it("accepts the documented extensions, case-insensitively", () => {
    expect(isSupported("notes.md")).toBe(true);
    expect(isSupported("NOTES.MD")).toBe(true);
    expect(isSupported("report.docx")).toBe(true);
    expect(isSupported("plain.txt")).toBe(true);
  });

  it("rejects everything else", () => {
    expect(isSupported("image.png")).toBe(false);
    expect(isSupported("legacy.doc")).toBe(false);
    expect(isSupported("noextension")).toBe(false);
  });

  it("derives a fallback title from the file name", () => {
    expect(baseName("C:\\docs\\Q3 plan.md")).toBe("Q3 plan");
    expect(baseName(".txt")).toBe("Imported document");
  });
});

describe("parseUpload", () => {
  it("turns markdown into a valid, editable document", async () => {
    const { doc, title } = await parseUpload(
      "spec.md",
      Buffer.from("# Spec\n\n- one\n- two", "utf8"),
    );
    expect(isValidDoc(doc)).toBe(true);
    expect(title).toBe("Spec");
    expect(docToPlainText(doc)).toBe("Spec\none\ntwo");
  });

  it("uses the file name when the content has no usable first line", async () => {
    const { title } = await parseUpload("meeting notes.txt", Buffer.from("\n\n", "utf8"));
    expect(title).toBe("meeting notes");
  });

  it("rejects unsupported types", async () => {
    await expect(parseUpload("a.png", Buffer.from([1, 2, 3]))).rejects.toBeInstanceOf(
      ImportError,
    );
  });

  it("rejects empty files", async () => {
    await expect(parseUpload("a.md", Buffer.alloc(0))).rejects.toThrow(/empty/i);
  });

  it("rejects files over the size limit with a 413", async () => {
    const oversized = Buffer.alloc(MAX_UPLOAD_BYTES + 1, 0x61);
    await expect(parseUpload("big.txt", oversized)).rejects.toMatchObject({
      status: 413,
    });
  });

  it("reports a readable error for a file that is not real .docx", async () => {
    // A .doc renamed to .docx is the common real-world case; mammoth throws a
    // low-level zip error that must not reach the user.
    await expect(
      parseUpload("fake.docx", Buffer.from("not a zip archive", "utf8")),
    ).rejects.toThrow(/could not read this \.docx/i);
  });
});
