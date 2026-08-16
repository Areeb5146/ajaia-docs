"use client";

import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";

type ButtonSpec = {
  label: string;
  title: string;
  /** Key into the derived state below; keeps re-renders scoped to what changed. */
  active: keyof ActiveState;
  run: (editor: Editor) => void;
  className?: string;
};

type ActiveState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  h1: boolean;
  h2: boolean;
  h3: boolean;
  bulletList: boolean;
  orderedList: boolean;
};

const GROUPS: ButtonSpec[][] = [
  [
    {
      label: "B",
      title: "Bold (Ctrl/Cmd+B)",
      active: "bold",
      className: "font-bold",
      run: (e) => e.chain().focus().toggleBold().run(),
    },
    {
      label: "I",
      title: "Italic (Ctrl/Cmd+I)",
      active: "italic",
      className: "italic font-serif",
      run: (e) => e.chain().focus().toggleItalic().run(),
    },
    {
      label: "U",
      title: "Underline (Ctrl/Cmd+U)",
      active: "underline",
      className: "underline",
      run: (e) => e.chain().focus().toggleUnderline().run(),
    },
  ],
  [
    {
      label: "H1",
      title: "Heading 1",
      active: "h1",
      run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      label: "H2",
      title: "Heading 2",
      active: "h2",
      run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: "H3",
      title: "Heading 3",
      active: "h3",
      run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
    },
  ],
  [
    {
      label: "• List",
      title: "Bulleted list",
      active: "bulletList",
      run: (e) => e.chain().focus().toggleBulletList().run(),
    },
    {
      label: "1. List",
      title: "Numbered list",
      active: "orderedList",
      run: (e) => e.chain().focus().toggleOrderedList().run(),
    },
  ],
];

export function EditorToolbar({
  editor,
  disabled,
}: {
  editor: Editor;
  disabled: boolean;
}) {
  // useEditorState subscribes to just these booleans instead of re-rendering the
  // toolbar on every keystroke transaction.
  const state = useEditorState({
    editor,
    selector: ({ editor: e }): ActiveState => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      h1: e.isActive("heading", { level: 1 }),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bulletList: e.isActive("bulletList"),
      orderedList: e.isActive("orderedList"),
    }),
  });

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="flex flex-wrap items-center gap-1 border-b border-line bg-surface px-3 py-2"
    >
      {GROUPS.map((group, index) => (
        <div key={index} className="flex items-center gap-1">
          {index > 0 && <span className="mx-1 h-5 w-px bg-line" aria-hidden />}
          {group.map((button) => {
            const isActive = state?.[button.active] ?? false;
            return (
              <button
                key={button.label}
                type="button"
                title={button.title}
                aria-label={button.title}
                aria-pressed={isActive}
                disabled={disabled}
                onMouseDown={(e) => e.preventDefault()} // keep the selection
                onClick={() => button.run(editor)}
                className={[
                  "min-w-9 rounded px-2 py-1 text-sm transition disabled:opacity-40",
                  button.className ?? "",
                  isActive
                    ? "bg-blue-100 text-accent"
                    : "text-foreground hover:bg-neutral-100",
                ].join(" ")}
              >
                {button.label}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
