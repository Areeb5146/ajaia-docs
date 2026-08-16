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
