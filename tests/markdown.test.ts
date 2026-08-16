import { describe, expect, it } from "vitest";
import { markdownToDoc } from "@/lib/markdown";
import { docToPlainText, isValidDoc } from "@/lib/doc";

describe("markdownToDoc", () => {
  it("produces a document the API validator accepts", () => {
    const doc = markdownToDoc("# Title\n\nBody text.");
    expect(isValidDoc(doc)).toBe(true);
  });

  it("converts headings and clamps levels deeper than h3", () => {
    const doc = markdownToDoc("# One\n## Two\n##### Five");
    const levels = doc.content.map((n) => n.attrs?.level);
    expect(doc.content.every((n) => n.type === "heading")).toBe(true);
    expect(levels).toEqual([1, 2, 3]);
  });

  it("groups consecutive bullets into a single list", () => {
    const doc = markdownToDoc("- alpha\n- beta\n- gamma");
    expect(doc.content).toHaveLength(1);
    expect(doc.content[0].type).toBe("bulletList");
    expect(doc.content[0].content).toHaveLength(3);
  });

  it("keeps bullet and numbered lists separate", () => {
    const doc = markdownToDoc("- alpha\n1. one");
    expect(doc.content.map((n) => n.type)).toEqual([
      "bulletList",
      "orderedList",
    ]);
  });

  it("applies inline marks and strips the delimiters", () => {
    const doc = markdownToDoc("Some **bold** and *italic* and <u>under</u>.");
    const runs = (doc.content[0].content ?? []) as Array<{
      text: string;
      marks?: { type: string }[];
    }>;
    const marked = Object.fromEntries(
      runs
        .filter((r) => r.marks?.length)
        .map((r) => [r.marks![0].type, r.text]),
    );
    expect(marked).toEqual({ bold: "bold", italic: "italic", underline: "under" });
    expect(runs.map((r) => r.text).join("")).toBe(
      "Some bold and italic and under.",
    );
  });

  it("does not re-parse markers inside inline code", () => {
    const doc = markdownToDoc("Use `a * b` here");
    const runs = (doc.content[0].content ?? []) as Array<{ text: string }>;
    expect(runs.map((r) => r.text).join("")).toBe("Use a * b here");
  });

  it("joins wrapped lines into one paragraph and splits on blank lines", () => {
    const doc = markdownToDoc("line one\nline two\n\nsecond para");
    expect(doc.content).toHaveLength(2);
    expect(docToPlainText(doc)).toBe("line one line two\nsecond para");
  });

  it("treats plain text with no markup as paragraphs", () => {
    const doc = markdownToDoc("just text");
    expect(doc.content[0].type).toBe("paragraph");
    expect(docToPlainText(doc)).toBe("just text");
  });

  it("never returns an empty document body", () => {
    // Tiptap cannot render a doc with no content; empty input must still be
    // editable.
    const doc = markdownToDoc("   \n\n  ");
    expect(doc.content).toHaveLength(1);
    expect(isValidDoc(doc)).toBe(true);
  });

  it("preserves code fences verbatim", () => {
    const doc = markdownToDoc("```\nconst a = 1;\n```");
    expect(doc.content[0].type).toBe("codeBlock");
    expect(docToPlainText(doc)).toBe("const a = 1;");
  });
});
