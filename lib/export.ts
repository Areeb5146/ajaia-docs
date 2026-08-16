import type { DocNode, Mark, TextNode } from "./doc";

/**
 * ProseMirror JSON -> Markdown. The inverse of `markdownToDoc`.
 *
 * Pure and dependency-free for the same reasons as the importer, which also
 * means a document can round-trip through export and import in tests.
 *
 * Underline has no Markdown syntax, so it is emitted as `<u>` — which the
 * importer understands, keeping the round-trip lossless for our mark set.
 */

const MARK_WRAPPERS: Record<string, [string, string]> = {
  bold: ["**", "**"],
  italic: ["*", "*"],
  underline: ["<u>", "</u>"],
  code: ["`", "`"],
  strike: ["~~", "~~"],
};

// Inner-most first, so `**bold** *italic*` nests predictably rather than
// producing `*__**`-style tangles.
const MARK_ORDER = ["code", "underline", "italic", "bold", "strike"];

function renderInline(nodes: DocNode[] = []): string {
  return nodes
    .map((node) => {
      if (node.type === "hardBreak") return "  \n";
      if (node.type !== "text") return renderInline((node.content ?? []) as DocNode[]);

      const text = (node as TextNode).text ?? "";
      if (!text) return "";

      const marks = new Set(((node.marks ?? []) as Mark[]).map((m) => m.type));
      return MARK_ORDER.reduce((acc, mark) => {
        if (!marks.has(mark as Mark["type"])) return acc;
        const [open, close] = MARK_WRAPPERS[mark];
        return `${open}${acc}${close}`;
      }, text);
    })
    .join("");
}

function renderBlock(node: DocNode, depth = 0): string {
  const children = (node.content ?? []) as DocNode[];
  const indent = "  ".repeat(depth);

  switch (node.type) {
    case "heading": {
      const level = Math.min(Number(node.attrs?.level ?? 1), 6);
      return `${"#".repeat(level)} ${renderInline(children)}`;
    }
    case "paragraph":
      return `${indent}${renderInline(children)}`;
    case "bulletList":
      return children
        .map((item) => renderListItem(item, depth, () => "- "))
        .join("\n");
    case "orderedList":
      return children
        .map((item, index) => renderListItem(item, depth, () => `${index + 1}. `))
        .join("\n");
    case "blockquote":
      return children
        .map((child) => renderBlock(child, depth))
        .join("\n")
        .split("\n")
        .map((line) => `> ${line}`.trimEnd())
        .join("\n");
    case "codeBlock":
      return ["```", renderInline(children), "```"].join("\n");
    case "horizontalRule":
      return "---";
    default:
      return renderInline(children);
  }
}

function renderListItem(
  item: DocNode,
  depth: number,
  marker: () => string,
): string {
  const blocks = (item.content ?? []) as DocNode[];
  const rendered = blocks.map((block) => renderBlock(block, depth + 1));
  const [first = "", ...rest] = rendered;
  const indent = "  ".repeat(depth);
  const lines = [`${indent}${marker()}${first.trim()}`];
  // Continuation blocks inside a list item are indented under the marker.
  rest.forEach((block) => lines.push(`${indent}  ${block.trim()}`));
  return lines.join("\n");
}

export function docToMarkdown(doc: unknown): string {
  if (!doc || typeof doc !== "object" || (doc as DocNode).type !== "doc") return "";
  const blocks = ((doc as DocNode).content ?? []) as DocNode[];
  return blocks
    .map((block) => renderBlock(block))
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Filesystem-safe file name derived from the document title. */
export function markdownFilename(title: string): string {
  const slug = title
    .trim()
    .replace(/[^\w\s.-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 60);
  return `${slug || "document"}.md`;
}
