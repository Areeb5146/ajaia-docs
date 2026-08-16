"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { useEffect, useRef, useState } from "react";
import type { Access } from "@/lib/access";
import { docToMarkdown, markdownFilename } from "@/lib/export";
import { ACCEPT_ATTRIBUTE, SUPPORTED_EXTENSIONS } from "@/lib/import";
import { EditorToolbar } from "./EditorToolbar";
import { useAutosave, type SaveStatus } from "./useAutosave";

type Props = {
  documentId: string;
  initialTitle: string;
  initialContent: object;
  access: Access;
};

const STATUS_LABEL: Record<SaveStatus, string> = {
  idle: "All changes saved",
  unsaved: "Unsaved changes…",
  saving: "Saving…",
  saved: "All changes saved",
  error: "Could not save",
};

async function patchDocument(
  documentId: string,
  body: { title?: string; content?: object },
) {
  const response = await fetch(`/api/documents/${documentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? "Could not save.");
  }
}

export function DocumentEditor({
  documentId,
  initialTitle,
  initialContent,
  access,
}: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const { status, error, schedule, saveNow } = useAutosave<{
    title?: string;
    content?: object;
  }>((value) => patchDocument(documentId, value));

  const editor = useEditor({
    // Rendering the editor during SSR causes a hydration mismatch; Tiptap wants
    // this off for the App Router.
    immediatelyRender: false,
    editable: access.canWrite,
    extensions: [
      // Link is disabled so the stored JSON stays inside the node/mark allowlist
      // the API validates against (lib/doc.ts).
      StarterKit.configure({ link: false, heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: "Start writing…" }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: "px-6 py-6 sm:px-10",
        "aria-label": "Document body",
      },
    },
    onUpdate: ({ editor: instance }) => {
      // Tiptap emits an update when the editor is made read-only. Without this
      // guard a viewer fires a PATCH that the server correctly rejects with 403,
      // and the failure surfaces as an alarming error box on a page they were
      // never allowed to edit.
      if (!access.canWrite) return;
      schedule({ content: instance.getJSON() });
    },
  });

  useEffect(() => {
    editor?.setEditable(access.canWrite);
  }, [editor, access.canWrite]);

  async function importIntoDocument(file: File) {
    setImportError(null);
    setImporting(true);
    try {
      // Flush pending edits first: the server appends to the stored document, so
      // an unsaved paragraph would otherwise be overwritten by the merge result.
      await saveNow();
      const data = new FormData();
      data.append("file", file);
      const response = await fetch(`/api/documents/${documentId}/import`, {
        method: "POST",
        body: data,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not import file.");
      editor?.commands.setContent(payload.content);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Could not import file.");
    } finally {
      setImporting(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  /** Export what is on screen, so unsaved edits are included. */
  function exportMarkdown() {
    if (!editor) return;
    const markdown = docToMarkdown(editor.getJSON());
    const url = URL.createObjectURL(
      new Blob([markdown], { type: "text/markdown;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = markdownFilename(title);
    link.click();
    URL.revokeObjectURL(url);
  }

  const readOnly = !access.canWrite;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={title}
          disabled={readOnly}
          aria-label="Document title"
          maxLength={200}
          onChange={(e) => {
            setTitle(e.target.value);
            const next = e.target.value.trim();
            // An empty title would fail server validation; hold the save until
            // there is something to send.
            if (next) schedule({ title: next });
          }}
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-xl font-semibold outline-none transition hover:border-line focus:border-accent disabled:cursor-default"
        />
        <span
          aria-live="polite"
          className={`text-xs ${status === "error" ? "text-red-600" : "text-muted"}`}
        >
          {readOnly ? "View only" : STATUS_LABEL[status]}
        </span>
      </div>

      {!readOnly && status === "error" && error && (
        <p role="alert" className="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}{" "}
          <button
            type="button"
            onClick={() => void saveNow()}
            className="underline underline-offset-2"
          >
            Retry
          </button>
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {access.canWrite && (
          <>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={importing}
              className="rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-medium transition hover:bg-neutral-50 disabled:opacity-50"
            >
              {importing ? "Importing…" : "Import file into this document"}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPT_ATTRIBUTE}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importIntoDocument(file);
              }}
            />
          </>
        )}

        {/* Viewers can export too — they are allowed to read the content. */}
        <button
          type="button"
          onClick={exportMarkdown}
          disabled={!editor}
          className="rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-medium transition hover:bg-neutral-50 disabled:opacity-50"
        >
          Export as Markdown
        </button>

        {access.canWrite && (
          <span className="text-xs text-muted">
            Imports append at the end · {SUPPORTED_EXTENSIONS.join(", ")} · max 2 MB
          </span>
        )}
      </div>

      {importError && (
        <p role="alert" className="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {importError}
        </p>
      )}

      <div className="editor-surface mt-4 overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
        {editor && !readOnly && (
          <EditorToolbar editor={editor} disabled={importing} />
        )}
        {editor ? (
          <EditorContent editor={editor} />
        ) : (
          <div className="px-6 py-10 text-sm text-muted">Loading editor…</div>
        )}
      </div>
    </div>
  );
}
