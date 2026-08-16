/**
 * Pure helpers for the ProseMirror/Tiptap document shape.
 *
 * These are deliberately dependency-free so they can run in the API layer, in
 * tests, and (if needed) in the browser without pulling in a DOM.
 */

export type Mark = { type: "bold" | "italic" | "underline" | "code" };

export type TextNode = { type: "text"; text: string; marks?: Mark[] };

export type DocNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[] | TextNode[];
  text?: string;
  marks?: Mark[];
};

export type ProseDoc = { type: "doc"; content: DocNode[] };

export const EMPTY_DOC: ProseDoc = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

/** Blocks we accept from clients. Anything else is dropped on write. */
const ALLOWED_NODES = new Set([
  "doc",
  "paragraph",
  "heading",
  "text",
  "bulletList",
  "orderedList",
  "listItem",
  "hardBreak",
  "blockquote",
  "codeBlock",
  "horizontalRule",
]);

const ALLOWED_MARKS = new Set(["bold", "italic", "underline", "code", "strike"]);

/**
 * Structural validation for content arriving from the client.
 *
 * We store JSON rather than HTML precisely so this check can be cheap and
 * total: reject unknown node/mark types instead of trying to sanitize markup.
 */
export function isValidDoc(value: unknown): value is ProseDoc {
  if (!value || typeof value !== "object") return false;
  const root = value as DocNode;
  if (root.type !== "doc") return false;
  if (!Array.isArray(root.content)) return false;
  return (root.content as DocNode[]).every(walk);

  function walk(node: unknown): boolean {
    if (!node || typeof node !== "object") return false;
    const n = node as DocNode;
    if (typeof n.type !== "string" || !ALLOWED_NODES.has(n.type)) return false;
    if (n.type === "text" && typeof n.text !== "string") return false;
    if (n.marks) {
      if (!Array.isArray(n.marks)) return false;
      if (!n.marks.every((m) => m && ALLOWED_MARKS.has((m as Mark).type)))
        return false;
    }
    if (n.content !== undefined) {
      if (!Array.isArray(n.content)) return false;
      if (!(n.content as DocNode[]).every(walk)) return false;
    }
    return true;
  }
}

/** Flatten a doc to plain text. Used for list previews and import titles. */
export function docToPlainText(doc: unknown): string {
  const lines: string[] = [];

  const visit = (node: DocNode, into: string[]) => {
    if (node.type === "text") {
      into.push(node.text ?? "");
      return;
    }
    if (node.type === "hardBreak") {
      into.push("\n");
      return;
    }
    const children = (node.content ?? []) as DocNode[];
    // Only leaf-level blocks emit a line. Containers (lists, listItem,
    // blockquote) wrap paragraphs, so counting them too would emit a blank line
    // per nesting level.
    const isBlock =
      node.type === "paragraph" ||
      node.type === "heading" ||
      node.type === "codeBlock";

    if (isBlock) {
      const buf: string[] = [];
      children.forEach((c) => visit(c, buf));
      lines.push(buf.join(""));
    } else {
      children.forEach((c) => visit(c, into));
    }
  };

  if (doc && typeof doc === "object" && (doc as DocNode).type === "doc") {
    ((doc as DocNode).content ?? []).forEach((c) =>
      visit(c as DocNode, [] as string[]),
    );
  }

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** First non-empty line, trimmed to a sane title length. */
export function deriveTitle(doc: unknown, fallback: string): string {
  const first = docToPlainText(doc)
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!first) return fallback;
  return first.length > 80 ? `${first.slice(0, 77)}...` : first;
}
