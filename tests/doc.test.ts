import { describe, expect, it } from "vitest";
import { deriveTitle, docToPlainText, isValidDoc } from "@/lib/doc";

const doc = (content: unknown[]) => ({ type: "doc", content });

describe("isValidDoc", () => {
  it("accepts the supported node and mark set", () => {
    expect(
      isValidDoc(
        doc([
          { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Hi" }] },
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [
                      { type: "text", text: "a", marks: [{ type: "bold" }] },
                    ],
                  },
                ],
              },
            ],
          },
        ]),
      ),
    ).toBe(true);
  });

  it("rejects a node type outside the allowlist", () => {
    // The allowlist is the sanitization boundary: a client could otherwise
    // persist arbitrary node types that the renderer would then trust.
    expect(isValidDoc(doc([{ type: "image", attrs: { src: "x" } }]))).toBe(false);
  });

  it("rejects an unknown mark", () => {
    expect(
      isValidDoc(
        doc([
          {
            type: "paragraph",
            content: [{ type: "text", text: "x", marks: [{ type: "link" }] }],
          },
        ]),
      ),
    ).toBe(false);
  });

  it("rejects a text node without text", () => {
    expect(isValidDoc(doc([{ type: "paragraph", content: [{ type: "text" }] }]))).toBe(
      false,
    );
  });

  it("rejects non-document values", () => {
    expect(isValidDoc(null)).toBe(false);
    expect(isValidDoc("<p>hi</p>")).toBe(false);
    expect(isValidDoc({ type: "paragraph" })).toBe(false);
  });
});

describe("docToPlainText", () => {
  it("puts each block on its own line", () => {
    const text = docToPlainText(
      doc([
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "T" }] },
        { type: "paragraph", content: [{ type: "text", text: "body" }] },
      ]),
    );
    expect(text).toBe("T\nbody");
  });

  it("returns an empty string for junk input", () => {
    expect(docToPlainText(undefined)).toBe("");
  });
});

describe("deriveTitle", () => {
  it("uses the first non-empty line", () => {
    expect(
      deriveTitle(
        doc([
          { type: "paragraph" },
          { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Real title" }] },
        ]),
        "fallback",
      ),
    ).toBe("Real title");
  });

  it("falls back when the document has no text", () => {
    expect(deriveTitle(doc([{ type: "paragraph" }]), "notes.md")).toBe("notes.md");
  });

  it("truncates very long first lines", () => {
    const long = "x".repeat(200);
    const title = deriveTitle(
      doc([{ type: "paragraph", content: [{ type: "text", text: long }] }]),
      "fallback",
    );
    expect(title).toHaveLength(80);
    expect(title.endsWith("...")).toBe(true);
  });
});
