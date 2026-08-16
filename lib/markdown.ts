/**
 * Minimal Markdown -> ProseMirror JSON converter.
 *
 * Why hand-rolled instead of `marked` + an HTML->JSON step: the HTML route needs
 * a DOM on the server, which means either a jsdom dependency or moving the
 * conversion to the browser. A ~120-line converter covering the subset the
 * editor actually supports (headings, lists, bold/italic/code) keeps the import
 * path server-side, dependency-free, and directly unit-testable.
 *
 * Deliberately NOT supported: tables, images, links, nested lists, reference
 * syntax. Unsupported syntax degrades to plain text rather than throwing.
 */

import type { DocNode, Mark, ProseDoc, TextNode } from "./doc";

const INLINE_PATTERNS: Array<{ re: RegExp; mark: Mark["type"] }> = [
  { re: /`([^`]+)`/, mark: "code" },
  { re: /\*\*([^*]+)\*\*/, mark: "bold" },
  { re: /__([^_]+)__/, mark: "bold" },
  { re: /<u>([\s\S]+?)<\/u>/, mark: "underline" },
  { re: /(?<!\*)\*([^*\n]+)\*(?!\*)/, mark: "italic" },
  { re: /(?<!_)_([^_\n]+)_(?!_)/, mark: "italic" },
];

/** Recursively split a line into text runs carrying inline marks. */
function parseInline(input: string, inherited: Mark["type"][] = []): TextNode[] {
  if (!input) return [];

  let best: { index: number; match: RegExpMatchArray; mark: Mark["type"] } | null =
    null;

  for (const { re, mark } of INLINE_PATTERNS) {
    const m = input.match(re);
    if (m && m.index !== undefined && (best === null || m.index < best.index)) {
      best = { index: m.index, match: m, mark };
    }
  }

  if (!best) return [makeText(input, inherited)].filter(Boolean) as TextNode[];

  const { index, match, mark } = best;
  const before = input.slice(0, index);
  const after = input.slice(index + match[0].length);

  return [
    ...parseInline(before, inherited),
    // `code` is a leaf mark in our schema: do not re-parse its contents.
    ...(mark === "code"
      ? ([makeText(match[1], [...inherited, mark])].filter(Boolean) as TextNode[])
      : parseInline(match[1], [...inherited, mark])),
    ...parseInline(after, inherited),
  ];
}

function makeText(text: string, marks: Mark["type"][]): TextNode | null {
  if (!text) return null;
  const node: TextNode = { type: "text", text };
  if (marks.length) {
    const unique = [...new Set(marks)];
    node.marks = unique.map((type) => ({ type }) as Mark);
  }
  return node;
}

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const ORDERED = /^\s*\d+[.)]\s+(.*)$/;
const HR = /^\s*(?:---+|\*\*\*+|___+)\s*$/;
const QUOTE = /^\s*>\s?(.*)$/;

/**
 * Convert Markdown (or plain text — plain text is valid Markdown here) into the
 * ProseMirror document shape Tiptap expects.
 */
export function markdownToDoc(markdown: string): ProseDoc {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const content: DocNode[] = [];

  let paragraph: string[] = [];
  let list: { type: "bulletList" | "orderedList"; items: DocNode[] } | null = null;
  let inFence = false;
  let fence: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const text = paragraph.join(" ").trim();
    paragraph = [];
    if (!text) return;
    content.push({ type: "paragraph", content: parseInline(text) as DocNode[] });
  };

  const flushList = () => {
    if (!list || !list.items.length) {
      list = null;
      return;
    }
    content.push({ type: list.type, content: list.items });
    list = null;
  };

  const flushAll = () => {
    flushParagraph();
    flushList();
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (/^\s*```/.test(line)) {
      if (inFence) {
        content.push({
          type: "codeBlock",
          content: fence.length
            ? ([{ type: "text", text: fence.join("\n") }] as DocNode[])
            : undefined,
        });
        fence = [];
        inFence = false;
      } else {
        flushAll();
        inFence = true;
      }
      continue;
    }
    if (inFence) {
      fence.push(raw);
      continue;
    }

    if (!line.trim()) {
      flushAll();
      continue;
    }

    if (HR.test(line)) {
      flushAll();
      content.push({ type: "horizontalRule" });
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      flushAll();
      content.push({
        type: "heading",
        // The editor exposes H1-H3; deeper levels clamp rather than disappear.
        attrs: { level: Math.min(heading[1].length, 3) },
        content: parseInline(heading[2]) as DocNode[],
      });
      continue;
    }

    const quote = line.match(QUOTE);
    if (quote) {
      flushAll();
      content.push({
        type: "blockquote",
        content: [
          { type: "paragraph", content: parseInline(quote[1]) as DocNode[] },
        ],
      });
      continue;
    }

    const bullet = line.match(BULLET);
    const ordered = line.match(ORDERED);
    if (bullet || ordered) {
      flushParagraph();
      const type = bullet ? "bulletList" : "orderedList";
      if (list && list.type !== type) flushList();
      if (!list) list = { type, items: [] };
      list.items.push({
        type: "listItem",
        content: [
          {
            type: "paragraph",
            content: parseInline((bullet ?? ordered)![1]) as DocNode[],
          },
        ],
      });
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  if (inFence && fence.length) {
    content.push({
      type: "codeBlock",
      content: [{ type: "text", text: fence.join("\n") }] as DocNode[],
    });
  }
  flushAll();

  return {
    type: "doc",
    content: content.length ? content : [{ type: "paragraph" }],
  };
}
