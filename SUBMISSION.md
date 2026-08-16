# Submission — Ajaia AI-Native Full Stack Developer Assignment

**Candidate:** Areeb Afzal · iareebafzal1122@gmail.com
**Project:** Ajaia Docs — a lightweight collaborative document editor

---

## Links

| What | Where |
| --- | --- |
| **Live app** | https://ajaia-docs-lovat.vercel.app |
| **Source code (GitHub)** | https://github.com/Areeb5146/ajaia-docs |
| **Walkthrough video** | `VIDEO_URL` |
| **Google Drive folder** | `DRIVE_URL` |

## Test accounts

No passwords — `/signin` is a mocked account picker. Click an account to sign in.

| Account | Email | Starts with |
| --- | --- | --- |
| Ava Chen | `ava@ajaia.test` | Owns both seeded documents |
| Ben Okafor | `ben@ajaia.test` | **Editor** on "Welcome", **viewer** on "Q3 planning notes" |
| Cleo Marsh | `cleo@ajaia.test` | No access — useful for verifying denial |

**60-second sharing check:** sign in as Ava → open a document → **Share** → grant
`cleo@ajaia.test` "Can view" → sign out → sign in as Cleo → it appears under **Shared with me**,
opens read-only, no toolbar.

---

## What is included

| File | Contents |
| --- | --- |
| `README.md` | Feature status, reviewer accounts, local setup, deployment, known limitations |
| `docs/ARCHITECTURE.md` | What I prioritized and why; stack rationale; data model; access model; what I'd build next |
| `docs/AI-WORKFLOW.md` | Tools, decomposition strategy, what AI output I rejected and why, verification method |
| `SUBMISSION.md` | This file |
| `app/` | Next.js App Router — pages and REST API routes |
| `components/` | Editor, toolbar, share dialog, autosave hook |
| `lib/` | Domain layer: access rules, document validation, Markdown import/export, upload gating |
| `prisma/` | Schema, migration, seed script |
| `tests/` | 43 vitest unit tests over the domain layer |
| `scripts/verify-ui.mjs` | 55 end-to-end browser checks (`npm run verify:ui`) |
| `samples/` | Example files for testing the upload flow |

---

## What works, end to end

- **Document lifecycle** — create, rename, edit, reopen. Documents persist across refresh and
  across sessions.
- **Rich text** — bold, italic, underline, H1–H3, bulleted and numbered lists, blockquote, inline
  code, code block, horizontal rule. Toolbar buttons reflect cursor state; keyboard shortcuts work.
- **Autosave** — debounced, coalescing (no lost edits during an in-flight save), with a truthful
  status indicator and a retry action on failure. No save button.
- **File upload** — two product-relevant behaviours:
  1. Upload `.txt` / `.md` / `.docx` → becomes a **new** editable document, titled from its first
     heading.
  2. Upload into an **existing** draft → content is appended (not replaced).
  Limits are stated in the UI next to both buttons: `.txt`, `.md`, `.markdown`, `.docx`, 2 MB max.
- **Sharing** — owner grants **viewer** or **editor** access by email, sees everyone with access,
  and can revoke. Roles are enforced server-side, not just in the UI.
- **Owned vs. shared** — the dashboard separates "My documents" from "Shared with me", showing the
  owner's name and whether you can edit or only view.
- **Validation and errors** — every failure path returns a readable message: unsupported file type,
  oversized file, corrupt `.docx`, empty title, unknown share recipient, invalid document content.
- **Export to Markdown** *(stretch)* — any document downloads as `.md` with formatting intact. It is
  the inverse of the import converter, and a test asserts a document round-trips through export and
  re-import unchanged. Viewers can export too, since they are allowed to read.
- **Role-based sharing** *(stretch)* — viewer vs. editor, enforced server-side. The brief asked for
  one stretch item; this and Markdown export are two.
- **Delete** — owner-only, with an inline confirmation that names the document and warns when other
  people will lose access.
- **Automated tests** — `npm test` runs 43 unit tests covering the permission matrix, the content
  validation allowlist, the Markdown converter and exporter, and upload gating. `npm run verify:ui`
  runs 55 end-to-end browser checks against a running build.

> The browser suite was run against the **live deployment**, not just locally
> (`VERIFY_BASE_URL=https://ajaia-docs-lovat.vercel.app npm run verify:ui`) — all 20 pass. The link
> above is a build I have actually exercised end to end, not one I assumed worked because it
> deployed.

## What is intentionally incomplete

Each of these was a deliberate cut, not an oversight. Reasoning is in `docs/ARCHITECTURE.md`.

| Not built | Why |
| --- | --- |
| **Real-time collaboration** | The single largest cost in the brief (CRDT/OT + websockets + presence). A half-finished implementation corrupts documents, which is worse than not having it. Autosave is last-write-wins; concurrent editors overwrite each other. |
| **Real authentication** | The brief permits seeded accounts. The session cookie holds an unsigned user id. Isolated to `lib/session.ts` so it is a contained change later. |
| **File storage** | Uploads are parsed in memory and discarded; only the resulting text is persisted. Storing originals means a blob store — another service for reviewers to configure, for no gain in the product behaviour asked for. |
| **API integration tests** | Unit tests cover the domain layer, where bugs are silent, and `npm run verify:ui` covers the browser flows. What's missing is a test database with fixtures for the HTTP layer; that matrix is currently verified by hand (documented in `docs/AI-WORKFLOW.md`). |
| **Invite flow for sharing** | There is no real signup, so sharing is limited to seeded emails. The UI says so when an unknown address is entered. |
| **Nested lists, tables, images, links** | Out of the editor schema on purpose — the schema is also the server-side validation allowlist, and every node type added is another thing to validate and to convert on import. |

## What I would build next, with another 2–4 hours

1. **Real-time collaboration** — Yjs + a websocket provider via Tiptap's collaboration extension.
   The document model already exists, which is what makes this tractable rather than a rewrite.
2. **API integration tests** against a throwaway Postgres, encoding the permission matrix I
   currently verify by hand.
3. **Real sessions** — signed cookies and a proper account model.
4. **Version history** — snapshots are straightforward given JSON content.
5. **Export to PDF** — Markdown export already ships; PDF needs a rendering step.

---

## Running it locally

```bash
npm install
cp .env.example .env          # set DATABASE_URL (any Postgres; `npx create-db` gives a free one)
npx prisma migrate deploy
npm run db:seed               # creates the 3 accounts above
npm run dev                   # http://localhost:3000
npm test                      # 43 tests
```

Full detail in `README.md`.
