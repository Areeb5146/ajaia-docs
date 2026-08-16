import { describe, expect, it } from "vitest";
import { docToMarkdown, markdownFilename } from "@/lib/export";
import { markdownToDoc } from "@/lib/markdown";

describe("docToMarkdown", () => {
  it("renders headings, marks, and both list types", () => {
    const doc = markdownToDoc(
      "# Title\n\nSome **bold** and *italic*.\n\n- one\n- two\n\n1. first\n2. second",
    );
    expect(docToMarkdown(doc)).toBe(
      [
        "# Title",
        "",
        "Some **bold** and *italic*.",
        "",
        "- one",
        "- two",
        "",
        "1. first",
        "2. second",
      ].join("\n"),
    );
  });

  it("emits underline as <u>, which the importer understands", () => {
    const doc = markdownToDoc("Text with <u>underline</u> in it.");
    expect(docToMarkdown(doc)).toBe("Text with <u>underline</u> in it.");
  });

  it("round-trips a document through export and import without loss", () => {
    // The strongest guarantee we can give cheaply: exporting and re-importing
    // must produce the same document tree.
    const source =
      "# Spec\n\nIntro with **bold**, *italic*, `code`.\n\n- alpha\n- beta\n\n> quoted line\n\n---";
    const first = markdownToDoc(source);
    const second = markdownToDoc(docToMarkdown(first));
    expect(second).toEqual(first);
  });

  it("round-trips adjacent runs with different marks", () => {
    // These export as `**bold***italic*`, which is an ambiguous-looking
    // delimiter run. Both our parser and CommonMark read it correctly, but it
    // is exactly the shape that silently breaks a naive exporter.
    const doc = {
      type: "doc" as const,
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "bold", marks: [{ type: "bold" as const }] },
            { type: "text", text: "italic", marks: [{ type: "italic" as const }] },
          ],
        },
      ],
    };
    expect(markdownToDoc(docToMarkdown(doc))).toEqual(doc);
  });

  it("returns an empty string for junk input", () => {
    expect(docToMarkdown(null)).toBe("");
    expect(docToMarkdown({ type: "paragraph" })).toBe("");
  });
});

describe("markdownFilename", () => {
  it("slugifies the title", () => {
    expect(markdownFilename("Q3 planning notes")).toBe("Q3-planning-notes.md");
  });

  it("strips characters that are unsafe in a file name", () => {
    expect(markdownFilename('Report: "final"/v2')).toBe("Report-finalv2.md");
  });

  it("falls back when the title slugifies to nothing", () => {
    expect(markdownFilename("///")).toBe("document.md");
  });
});
