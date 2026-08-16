# AI workflow note

## Tools used

- **Claude Code (Opus 5) in VS Code** — the primary tool, used agentically: it wrote files, ran the
  toolchain, executed the test suite, and drove `curl` against the running server. I directed the
  decomposition, made the scope calls, and reviewed every diff.
- **`npx create-next-app` / `prisma init` / `create-db`** — ordinary scaffolding, not AI.

I did not use multiple assistants. Splitting attention across tools costs more than it returns in a
4-hour window.

## How I decomposed the work

I refused to start with "build a Google Docs clone" as a single prompt. That produces a plausible
demo with no working access control. Instead I ordered the work by **risk**, not by feature list:

1. **Decide what to cut first.** Real-time collaboration is the highest-cost, highest-risk piece.
   Cutting it deliberately, in the first five minutes, is what made the rest of the plan fit.
2. **Get persistence live before writing UI.** A database that works locally but not in production
   is the classic take-home failure. Schema and a real hosted Postgres came before any component.
3. **Write the pure domain layer first** — access rules, document validation, Markdown conversion.
   These are the parts where a bug is invisible, and they're the parts worth testing.
4. **Then routes, then UI, then docs.** UI last, because it's the cheapest thing to fix and the most
   tempting thing to over-polish.

Prompting followed the same shape: I gave the model the *constraint and the reason*, not just the
task. "Write a Markdown converter" produces a `marked` dependency and a server-side DOM problem.
"Write a Markdown-to-ProseMirror converter that runs in Node with no DOM, covering only the node
types our schema allows, and make it unit-testable" produces the thing I actually wanted.

## Where AI materially sped up the work

- **Boilerplate with a known shape** — REST handlers, Zod schemas, Tailwind markup, the share
  dialog. This is the bulk of the line count and near-zero of the thinking.
- **Test enumeration.** I specified the permission matrix and the edge cases I cared about; the
  model wrote 35 tests covering them faster than I would have, including cases I'd have skipped
  under time pressure (anonymous caller, stale owner-share row, `.doc` renamed to `.docx`).
- **Documentation drafting** — this note, the README tables, and the architecture note started as
  drafts I restructured.
- **Fast recovery from toolchain surprises.** Prisma 7 and Tiptap 3 both changed in ways that broke
  the first attempt; iterating on real error output was much faster than reading migration guides.

Rough split: AI wrote most of the characters, I made all of the decisions.

## What AI-generated output I changed or rejected

This is the part that matters, so it's specific.

1. **Rejected `@prisma/adapter-neon`.** The first pass installed the Neon adapter by default. Prisma
   7 requires *some* driver adapter, but binding to Neon's would have locked the project to one
   provider. Swapped to `@prisma/adapter-pg`, which speaks plain Postgres — the app now runs against
   Prisma Postgres, Neon, Supabase, or local with only `DATABASE_URL` changing.

2. **Rejected two Tiptap packages that were already bundled.** The model installed
   `@tiptap/extension-underline` and `@tiptap/extension-placeholder` — correct for Tiptap v2,
   **wrong for v3**, where both ship inside `starter-kit` / `@tiptap/extensions`. Registering a
   duplicate extension breaks the editor schema. I caught it by reading the actual installed
   `starter-kit/package.json` rather than trusting the suggestion, then removed both. This is the
   clearest example of a model confidently applying a stale-but-plausible pattern.

3. **Rejected trusting the `mammoth` type definitions.** `convertToMarkdown` is absent from
   mammoth's `.d.ts`, which would normally mean "don't use it." I checked the runtime exports before
   building on it — it exists — and typed the call locally instead of reaching for `any`. Going the
   other way (trusting the types, using `convertToHtml`) would have forced a server-side DOM
   dependency for no reason.

4. **Rewrote the autosave hook after the React Compiler rejected it.** The first version used
   `useCallback` around a self-recursive `flush`, plus a ref written during render. Next 16's React
   Compiler lint flagged both as real correctness issues. I removed the manual memoization entirely
   and moved the ref sync into an effect, which is both correct and simpler.

5. **Deleted the agent scaffolding `prisma init` dropped into the repo** (`.claude/skills/`,
   `AGENTS.md`, `CLAUDE.md`). Tooling artifacts don't belong in a submitted codebase.

6. **Overrode the default "replace" semantics for import-into-an-existing-document.** The obvious
   implementation replaces the content. That silently destroys work and there's no undo across a
   save boundary, so I changed it to append — and made the editor flush pending edits before the
   import request, since the server merges against *stored* content.

## How I verified correctness

Four layers, in increasing cost:

1. **`tsc --noEmit` and `eslint`** on every change. The React Compiler rules in Next 16 caught the
   autosave bug described above.
2. **`vitest run` — 35 tests** over the pure modules. This caught a real bug: `docToPlainText`
   emitted phantom blank lines between list items, because `listItem` and `blockquote` wrap
   paragraphs and were both being counted as text-emitting blocks. Nothing in the UI would have made
   that obvious; it would have shown up as ugly dashboard previews.
3. **A production build** (`npm run build`) before deploying, not after.
4. **A headless-browser pass** (`npm run verify:ui`, 18 checks) driving the real UI against the
   production build. This is the layer that earned its cost — it caught **two bugs nothing else
   could have**:

   - **Autosave dropped edits.** The debounce queue *replaced* the pending payload instead of
     merging it. The editor schedules `{ content }` and the title field schedules `{ title }`, so
     typing and then renaming silently discarded the content edit. The browser check found it by
     doing the obvious human thing — edit, rename, reload — and finding the title saved and the body
     empty. Fixed by merging into the pending object.
   - **A read-only user saw a permission error.** Tiptap emits an update when the editor is switched
     to read-only, which fired a `PATCH` that the server correctly rejected with 403 — surfacing an
     alarming red error box to a viewer who was never allowed to edit. The API was behaving
     perfectly; the bug was only visible from the browser. Fixed by guarding `onUpdate` on the write
     capability.

   Both are the kind of defect that survives a green type check, a green test suite, and a clean
   `curl` matrix, and then greets a reviewer thirty seconds into the demo.

5. **An end-to-end `curl` matrix against the running production server**, covering the paths a
   reviewer will actually try — and, more importantly, every denial path:

   | Check | Expected | Result |
   | --- | --- | --- |
   | Anonymous create | 401 | 401 |
   | Viewer attempts to edit | 403 | 403 |
   | Editor attempts to share | 403 | 403 |
   | User with no access | 404 (not 403 — no existence leak) | 404 |
   | Access after revoke | 404 | 404 |
   | Invalid content node (`{"type":"script"}`) | 422 | 422 |
   | Empty title | 422 with readable message | 422 |
   | `.png` upload | rejected, readable message | rejected |
   | Share unknown email | 404, explains seeded accounts | 404 |
   | Role upgrade viewer → editor, then write | 200 | 200 |

**On UX quality**, automated checks only go so far — I also drove the actual flows in the browser: create,
format with both toolbar and keyboard shortcuts, refresh to confirm formatting persisted, import a
file, share, and re-open as the recipient to confirm the read-only state renders without a toolbar.

## What I'd tell a teammate about using AI here

The model is fastest at code whose shape is already decided and slowest to be trusted where the
ecosystem moved recently. Every mistake worth catching in this build came from the second category —
Prisma 7's adapter requirement, Tiptap 3's bundled extensions, React 19's compiler rules. The
practical habit that caught all three: **verify against the installed artifact, not against the
model's recollection** — read the real `package.json`, check the runtime exports, run the linter.
That takes seconds and it's where the leverage actually is.
