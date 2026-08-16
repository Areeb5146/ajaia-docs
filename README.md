# Ajaia Docs

A lightweight collaborative document editor — create, format, import, share, and persist documents.

Built for the Ajaia AI-Native Full Stack Developer assignment.

- **Live app:** https://ajaia-docs-lovat.vercel.app
- **Architecture note:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **AI workflow note:** [docs/AI-WORKFLOW.md](docs/AI-WORKFLOW.md)

---

## What it does

| Capability | Status |
| --- | --- |
| Create, rename, edit, reopen documents | Working |
| Rich text: bold, italic, underline, H1–H3, bullet + numbered lists, quote, code, rule | Working |
| Autosave (debounced, with save-state indicator and retry) | Working |
| Upload `.txt` / `.md` / `.docx` → new document | Working |
| Upload a file into an existing draft (appended) | Working |
| Share by email with **viewer** or **editor** role; revoke access | Working |
| Owned vs. shared documents visibly separated | Working |
| Persistence in Postgres; formatting survives refresh | Working |
| **Stretch:** role-based sharing (viewer / editor) | Working |
| **Stretch:** export a document to Markdown | Working |
| Delete a document (owner-only, with confirmation) | Working |
| Automated tests (43 unit + 55 end-to-end browser checks) | Working |
| Real-time multi-user editing | **Not built** — see ARCHITECTURE.md |
| Real authentication | **Not built** — mocked, seeded accounts by design |

## Reviewer accounts

Sign-in is a mocked account picker — no passwords. Pick an account on `/signin`.

| Account | Email | Starts with |
| --- | --- | --- |
| Ava Chen | `ava@ajaia.test` | Owns both seeded documents |
| Ben Okafor | `ben@ajaia.test` | **Editor** on "Welcome", **viewer** on "Q3 planning notes" |
| Cleo Marsh | `cleo@ajaia.test` | No access to anything — useful for testing denial |

**To see the sharing model in 60 seconds:** sign in as Ava → open a document → **Share** →
grant `cleo@ajaia.test` "Can view" → sign out → sign in as Cleo → the document appears under
**Shared with me**, opens read-only, and the toolbar is hidden.

## Supported uploads

`.txt`, `.md`, `.markdown`, `.docx` — **2 MB max**. This is stated in the UI next to both upload
buttons as well as here. Anything else is rejected with a readable message.

`.docx` is converted via [mammoth](https://github.com/mwilliamson/mammoth.js) to Markdown and then
through the same converter as `.md`, so there is exactly one code path from text to document nodes.
Word features outside the editor's schema (images, tables, colors) are dropped rather than mangled.

---

## Run it locally

**Requirements:** Node 20+ and any Postgres database.

```bash
git clone <this repo>
cd ajaia-docs
npm install
```

### 1. Point it at a database

```bash
cp .env.example .env
```

Then set `DATABASE_URL`. If you don't have a Postgres instance handy, this creates a free one with
no signup and prints a connection string:

```bash
npx create-db
```

Any Postgres works — Neon, Supabase, Railway, or local — because the app connects through Prisma's
`adapter-pg` driver adapter.

### 2. Create the schema and seed the demo data

```bash
npx prisma migrate deploy   # or: npm run db:migrate  (for a dev database)
npm run db:seed             # creates the 3 accounts + 2 documents + 2 shares
```

### 3. Start it

```bash
npm run dev     # http://localhost:3000
```

Production build:

```bash
npm run build && npm start
```

> `npm run build` runs `prisma generate && prisma migrate deploy && next build`, so a deployment
> applies pending migrations automatically. It does **not** seed — run `npm run db:seed` once
> against the deployed database.

### Other commands

```bash
npm test          # 43 unit tests (vitest)
npm run typecheck # tsc --noEmit
npm run lint      # eslint + React Compiler rules
npm run db:studio # browse the data
```

### End-to-end UI check

`npm test` covers the domain layer. `scripts/verify-ui.mjs` covers what only a real browser can
prove — that the editor hydrates, that formatting survives a round-trip through the database, and
that a viewer genuinely cannot edit.

```bash
npx playwright install chromium   # one-time
npm run build && npm start        # terminal 1
npm run verify:ui                 # terminal 2 — 55 checks
```

It signs in, applies formatting, waits for autosave, reloads and re-checks the formatting, uploads
`samples/sample-import.md`, shares with a second account, and asserts the recipient gets a read-only
editor — while watching for uncaught console errors and failed API calls throughout. Point it at a
deployment with `VERIFY_BASE_URL=https://… npm run verify:ui`.

This found two real bugs that neither the type checker nor the unit tests could: see
[docs/AI-WORKFLOW.md](docs/AI-WORKFLOW.md).

---

## Deploying

Any Node host works. On Vercel:

1. Import the repository.
2. Set `DATABASE_URL` as an environment variable.
3. Deploy. The build applies migrations; run `npm run db:seed` once against that database so the
   reviewer accounts exist.

The upload routes are pinned to the Node runtime (`export const runtime = "nodejs"`) because the
`.docx` parser needs Node APIs.

---

## Project layout

```
app/
  api/                      REST endpoints (all mutations)
    session/                mocked sign-in / sign-out
    documents/              create, update, delete, share, import-into
    import/                 upload -> new document
  documents/                dashboard + editor pages (server components)
  signin/                   account picker
components/                 client components (editor, toolbar, share dialog)
lib/
  access.ts                 permission rules — pure, fully unit-tested
  doc.ts                    document shape, validation allowlist, plain-text
  markdown.ts               Markdown -> ProseMirror JSON converter
  import.ts                 upload gating + .docx handling
  documents.ts              shared load-with-permission helper
  api.ts                    error -> HTTP response mapping
prisma/                     schema, migrations, seed
tests/                      vitest suites for the modules above
```

## Known limitations

Stated plainly rather than hidden — the reasoning is in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

- **No real-time collaboration.** Autosave is last-write-wins. Two people editing the same document
  simultaneously will overwrite each other. Sequential collaboration works correctly.
- **Auth is mocked.** The session cookie holds an unsigned user id. Fine for a demo, not for
  production.
- **Sharing is by seeded email only.** There is no invite flow, because there is no real signup.
- **No file storage.** Uploads are parsed in memory and discarded; only the resulting text is
  persisted. No blob-store dependency to configure.
- **Tests cover the domain layer, not the UI.** See ARCHITECTURE.md for why, and what I'd add next.
