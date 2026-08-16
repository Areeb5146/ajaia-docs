# Architecture note

What I prioritized, what I cut, and why.

---

## The core judgment call

The prompt describes something like Google Docs. Google Docs' defining feature is real-time
multiplayer, which needs CRDTs or OT, a websocket layer, presence, and a persistence model that can
merge concurrent edits. That is most of a 4-hour budget on its own, and a half-finished CRDT is
worse than none — it corrupts documents.

So I inverted the priority: **make single-user editing genuinely good and the access model
genuinely correct, and cut real-time entirely.** The brief explicitly rewards deliberate scope cuts,
and asks for "depth in a few important areas over shallow coverage everywhere."

What that bought:

- An editor that actually feels usable — real formatting, autosave with honest save state,
  placeholder, keyboard shortcuts, no save button.
- An access model that is correct at the API layer, not just hidden in the UI. Every permission path
  is tested and was verified against the running server.
- An import pipeline that handles three formats through one code path and fails with readable
  messages.

## Stack

| Choice | Why |
| --- | --- |
| **Next.js 16 (App Router)** | One deployable unit for frontend + API. Server components read data directly, so the dashboard and editor pages need no client-side fetch on load. |
| **Tiptap 3 (ProseMirror)** | Gives a real document model rather than a `contentEditable` div. Writing rich text from scratch is a trap; ProseMirror's schema is also what makes server-side validation tractable. |
| **Postgres + Prisma 7** | Relational data (users, documents, shares with a unique constraint) with real referential integrity. Prisma's `adapter-pg` means the same code runs against Prisma Postgres, Neon, Supabase, or local — only `DATABASE_URL` changes. |
| **Zod** | Request validation at the boundary, with messages good enough to show the user directly. |
| **Vitest** | Fast, no config, runs the pure domain modules in Node with no DOM. |
| **Tailwind v4** | Speed. Not a design system, and not pretending to be one. |

## Data model

```
User ──owns──< Document ──has──< Share >── User
```

Three tables. The interesting decisions:

**Content is stored as ProseMirror JSON, not HTML.** HTML from a browser is untrusted markup that
has to be sanitized on every read, and sanitizing HTML correctly is genuinely hard. JSON with a node
and mark **allowlist** (`lib/doc.ts`) is a total, cheap check: unknown node types are rejected at
write time, so nothing unexpected is ever stored. The editor's `Link` extension is disabled
specifically to keep the client's output inside that allowlist.

**`plainText` is denormalized onto the document.** Dashboard previews would otherwise mean parsing
every document's JSON on every list render. It's written in the same transaction as the content, so
it cannot drift.

**`Share` has a unique constraint on `(documentId, userId)`** and the share endpoint upserts. Sharing
with the same person twice changes their role rather than erroring or creating a duplicate.

## Access control

All permission logic lives in one pure function, `resolveAccess` in `lib/access.ts`, which returns
capability flags rather than a role string:

```ts
{ level, canRead, canWrite, canManageSharing, canDelete }
```

Routes call `loadDocumentFor(id, viewerId)` and then `assertCan(access, "canWrite")`. No route
re-implements the rules, so the API and the UI cannot disagree — the editor renders read-only using
the *same* flags the server enforces with.

Two deliberate details:

- **No access and "does not exist" both return 404.** A 403 on a document you can't see would leak
  that it exists.
- **Only the owner can share or revoke.** Editors can edit but not re-share. This is the smallest
  rule set that is still coherent; transitive sharing needs an invite/ownership-transfer story that
  didn't fit.

## Editing and saving

Autosave is a debounced `PATCH` (900 ms) implemented in `components/useAutosave.ts`, with:

- a coalescing queue — edits during an in-flight save are not lost, and only one request is ever in
  flight;
- an honest status line (`Unsaved changes` → `Saving…` → `All changes saved`, or an error with a
  retry button) rather than a fake "Saved" that lies when the network is down;
- a `beforeunload` guard so closing the tab mid-save warns.

**It is last-write-wins.** Two people editing at once will clobber each other. This is the single
biggest limitation and it is stated in the UI-facing README rather than buried.

Importing into an existing document flushes pending edits **first**, because the server appends to
the stored content — without the flush, an unsaved paragraph would be lost in the merge.

## File import

One pipeline, three formats:

```
.txt ─┐
.md  ─┼─> Markdown string ─> markdownToDoc() ─> ProseMirror JSON ─> validated ─> stored
.docx┘        (via mammoth)
```

I hand-rolled the Markdown converter (~120 lines) rather than using `marked` + an HTML→JSON step.
The library route needs a DOM on the server, which means either a `jsdom` dependency or moving
conversion into the browser where it can't be trusted or tested. The hand-rolled version keeps
import server-side, dependency-free, and directly unit-testable — and it only has to cover the
subset the editor's schema actually supports.

Uploads are parsed in memory and discarded. Persisting the original file would mean a blob store —
another service for reviewers to configure, and the brief says not to require paid dependencies.
The product-relevant behaviour ("turn a file into an editable document") does not need the bytes.

Rejections are explicit: unsupported extension, empty file, over 2 MB (checked before buffering),
and a corrupt/renamed `.docx` — that last one otherwise surfaces as a raw zip error from mammoth.

## Testing

42 tests over the five pure modules: access rules, document validation, the Markdown converter, the
Markdown exporter, and upload gating. Plus 20 end-to-end browser checks (`npm run verify:ui`).

The export suite includes a **round-trip assertion** — a document exported to Markdown and
re-imported must produce an identical tree. That is the cheapest strong guarantee available for two
converters that have to agree.

I unit-tested the **domain layer, not the UI**, because that's where a bug is silent. A broken toolbar
button is visible in five seconds; an access rule that grants an editor the ability to re-share is
not. The access test is a full permission matrix including the anonymous case and a stale
owner-share row.

This paid off immediately: the plain-text test caught a real bug where list items emitted phantom
blank lines, because `listItem` and `blockquote` wrap paragraphs and were both being counted as
text blocks.

The API layer was verified by exercising the running server end to end — create, update, invalid
content, empty title, import, unsupported type, share, role upgrade, revoke, and every denial path
(401 anonymous, 403 viewer-writes, 403 editor-shares, 404 stranger, 404 after revoke). Automating
that needs a test database and fixtures; with the remaining budget, manual verification of a known
matrix was the better trade.

## What I'd build next, in order

1. **Real-time collaboration** — Yjs + a websocket provider, with Tiptap's collaboration extension.
   This is the honest gap, and Tiptap makes it tractable because the document model already exists.
2. **Real auth** — signed sessions and a real account model. The mocked layer is isolated to
   `lib/session.ts`, so this is a contained change.
3. **API integration tests** — against a throwaway Postgres, encoding the permission matrix I
   verified by hand.
4. **Version history** — the JSON content model makes snapshots straightforward.
5. **Export to PDF** — Markdown export already ships (`lib/export.ts`, with a round-trip test);
   PDF needs a rendering step.
