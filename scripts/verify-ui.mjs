/**
 * End-to-end verification against a running server, in real Chromium.
 * Covers the happy paths, every denial path, validation, and UI edge cases.
 * Writes screenshots so the run can be reviewed by eye.
 *
 * Usage:  npm run build && npm start   (one terminal)
 *         npm run verify:ui            (another)
 *         VERIFY_BASE_URL=https://… npm run verify:ui   (against a deployment)
 *
 * NOTE: this writes to whatever database the target uses. It creates, shares
 * and deletes real documents, and cleans up after itself on the happy path —
 * but an aborted run can leave the seeded reviewer state drifted. Run
 * `npm run db:seed` afterwards to restore it; the seed is idempotent.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const SAMPLE_MD = here("../samples/sample-import.md");
const TMP_TXT = here("../.verify-tmp.txt");
const TMP_PNG = here("../.verify-tmp.png");

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const SHOTS = here("../.verify-shots");
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
let n = 0;
const ok = (name, pass, extra = "") => {
  n++;
  results.push(`${pass ? "PASS" : "FAIL"}  ${String(n).padStart(2)}. ${name}${extra ? "  :: " + extra : ""}`);
};
const shot = async (page, name) =>
  page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });

const browser = await chromium.launch();
const made = [];

async function session(label) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`${label} pageerror: ${e}`));
  page.on("console", (m) => {
    const t = m.text();
    // 4xx responses are produced deliberately by the negative tests below.
    if (m.type() === "error" && !/status of 4\d\d/.test(t)) errors.push(`${label} console: ${t}`);
  });
  page.on("response", (r) => {
    const u = r.url();
    if (u.includes("/api/") && r.status() >= 500)
      errors.push(`${label} HTTP ${r.status()} ${r.request().method()} ${u}`);
  });
  return { ctx, page, errors, label };
}

const signIn = async (s, name) => {
  await s.page.goto(`${BASE}/signin`);
  await s.page.getByText(name).click();
  await s.page.waitForURL("**/documents");
};

let ava, ben, cleo, docUrl;

try {
  // ---------------------------------------------------------------- sign-in
  ava = await session("ava");
  await ava.page.goto(`${BASE}/`);
  await ava.page.waitForURL("**/signin");
  ok("signed-out root redirects to /signin", true);
  await shot(ava.page, "01-signin");

  ok(
    "all three seeded accounts listed",
    (await ava.page.getByText("@ajaia.test").count()) === 3,
  );

  await ava.page.getByText("Ava Chen").click();
  await ava.page.waitForURL("**/documents");
  ok("sign-in lands on dashboard", true);

  const ownedHeading = await ava.page.getByText(/My documents \(\d+\)/).textContent();
  const sharedHeading = await ava.page.getByText(/Shared with me \(\d+\)/).textContent();
  ok("dashboard splits owned vs shared", true, `${ownedHeading} / ${sharedHeading}`);
  await shot(ava.page, "02-dashboard-ava");

  // ------------------------------------------------------------- editing
  await ava.page.getByRole("button", { name: "New document" }).click();
  await ava.page.waitForURL(/\/documents\/[a-z0-9]+/);
  docUrl = ava.page.url();
  made.push(docUrl);
  await ava.page.waitForSelector(".ProseMirror", { timeout: 20000 });
  ok("new document opens with a hydrated editor", true);

  const body = ava.page.locator(".ProseMirror");
  ok(
    "empty document shows a placeholder",
    await ava.page.locator(".is-editor-empty").isVisible(),
  );

  await body.click();
  await ava.page.keyboard.type("Audit heading");
  await ava.page.getByRole("button", { name: "Heading 1" }).click();
  ok("toolbar H1 applies", (await body.locator("h1").count()) === 1);

  await ava.page.keyboard.press("End");
  await ava.page.keyboard.press("Enter");

  // keyboard shortcuts, one mark at a time
  for (const [combo, tag, label] of [
    ["Control+b", "strong", "bold"],
    ["Control+i", "em", "italic"],
    ["Control+u", "u", "underline"],
  ]) {
    await ava.page.keyboard.press(combo);
    await ava.page.keyboard.type(`${label} text`);
    await ava.page.keyboard.press(combo);
    ok(`Ctrl shortcut applies ${label}`, (await body.locator(tag).count()) > 0);
  }

  await ava.page.keyboard.press("Enter");
  await ava.page.getByRole("button", { name: "Bulleted list" }).click();
  await ava.page.keyboard.type("bullet one");
  ok("bulleted list works", (await body.locator("ul li").count()) === 1);

  await ava.page.keyboard.press("Enter");
  await ava.page.keyboard.press("Enter"); // exit the list
  await ava.page.getByRole("button", { name: "Numbered list" }).click();
  await ava.page.keyboard.type("number one");
  ok("numbered list works", (await body.locator("ol li").count()) === 1);

  await ava.page.keyboard.press("Enter");
  await ava.page.keyboard.press("Enter");
  await ava.page.waitForTimeout(700);
  await ava.page.keyboard.type("EXTRA-UNDO-ME");
  await ava.page.waitForTimeout(700);
  await ava.page.keyboard.press("Control+z");
  await ava.page.waitForTimeout(300);
  ok(
    "undo works",
    !(await body.textContent())?.includes("EXTRA"),
  );

  // ------------------------------------------------------- title + autosave
  const title = ava.page.getByLabel("Document title");
  ok("new document is titled 'Untitled document'", (await title.inputValue()) === "Untitled document");
  await title.fill("Audit document");

  await ava.page.getByText("All changes saved").waitFor({ timeout: 20000 });
  await ava.page.waitForTimeout(1500);
  ok("autosave settles on 'All changes saved'", true);
  await shot(ava.page, "03-editor-formatted");

  // the regression that mattered: content + title in one debounce window
  await ava.page.reload();
  await ava.page.waitForSelector(".ProseMirror h1", { timeout: 20000 });
  const counts = {
    h1: await body.locator("h1").count(),
    strong: await body.locator("strong").count(),
    em: await body.locator("em").count(),
    u: await body.locator("u").count(),
    ul: await body.locator("ul li").count(),
    ol: await body.locator("ol li").count(),
  };
  ok(
    "all formatting survives reload",
    Object.values(counts).every((c) => c > 0),
    JSON.stringify(counts),
  );
  ok("renamed title survives reload", (await title.inputValue()) === "Audit document");

  // --------------------------------------------------- title validation
  await title.fill("   ");
  await ava.page.waitForTimeout(2500);
  await ava.page.reload();
  await ava.page.waitForSelector(".ProseMirror", { timeout: 20000 });
  ok(
    "blank title is not persisted (server would reject it)",
    (await title.inputValue()).trim() === "Audit document",
    `got "${await title.inputValue()}"`,
  );

  // ------------------------------------------------------------- export
  const [dl] = await Promise.all([
    ava.page.waitForEvent("download", { timeout: 20000 }),
    ava.page.getByRole("button", { name: "Export as Markdown" }).click(),
  ]);
  const md = await dl.createReadStream().then(async (s) => {
    const c = [];
    for await (const x of s) c.push(x);
    return Buffer.concat(c).toString("utf8");
  });
  ok(
    "export contains heading, marks and both list types",
    md.includes("# Audit heading") &&
      md.includes("**bold text**") &&
      md.includes("<u>underline text</u>") &&
      md.includes("- bullet one") &&
      md.includes("1. number one"),
    dl.suggestedFilename() + " | " + JSON.stringify(md.slice(0, 260)),
  );

  // ------------------------------------------------------------- uploads
  fs.writeFileSync(TMP_TXT, "Plain notes\n\nSecond paragraph.\n");
  fs.writeFileSync(TMP_PNG, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

  // React must have hydrated before setInputFiles, or the change event fires
  // with no handler attached and the upload silently does nothing.
  const ready = async (p) => {
    await p.getByRole("button", { name: "New document" }).waitFor({ timeout: 20000 });
    await p.waitForTimeout(2000);
  };

  await ava.page.goto(`${BASE}/documents`);
  await ready(ava.page);
  await ava.page.setInputFiles('input[type="file"]', TMP_TXT);
  await ava.page.waitForURL(/\/documents\/[a-z0-9]+/, { timeout: 25000 });
  made.push(ava.page.url());
  await ava.page.waitForSelector(".ProseMirror", { timeout: 20000 });
  ok(
    "uploading .txt creates a document titled from its first line",
    (await ava.page.getByLabel("Document title").inputValue()) === "Plain notes",
  );

  await ava.page.goto(`${BASE}/documents`);
  await ready(ava.page);
  await ava.page.setInputFiles('input[type="file"]', TMP_PNG);
  // Assert on the message itself rather than the alert role: more than one
  // live region can be on screen at once.
  const uploadRejected = await ava.page
    .getByText(/Unsupported file type\. Supported: \.txt, \.md, \.markdown, \.docx/i)
    .waitFor({ timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  ok("unsupported file type is rejected with a readable message", uploadRejected);
  await shot(ava.page, "04-upload-rejected");

  // import into an existing document
  await ava.page.goto(docUrl);
  await ava.page.waitForSelector(".ProseMirror", { timeout: 20000 });
  const h1Before = await body.locator("h1").count();
  await ava.page.setInputFiles('input[type="file"]', SAMPLE_MD);
  const appended = await ava.page
    .waitForFunction(
      (before) => document.querySelectorAll(".ProseMirror h1").length > before,
      h1Before,
      { timeout: 25000 },
    )
    .then(() => true)
    .catch(() => false);
  ok("import into an open document appends rather than replaces", appended);

  // ------------------------------------------------------------- sharing
  await ava.page.getByRole("button", { name: "Share" }).click();
  const emailField = ava.page.getByLabel("Email of a seeded account");
  await emailField.waitFor({ timeout: 15000 });
  const submitShare = ava.page.getByRole("button", { name: "Share", exact: true }).last();

  await emailField.fill("nobody@ajaia.test");
  await submitShare.click();
  const unknownRejected = await ava.page
    .getByText(/No account with that email/i)
    .waitFor({ timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  ok("sharing with an unknown email explains the seeded-account limit", unknownRejected);

  await emailField.fill("ava@ajaia.test");
  await submitShare.click();
  const selfRejected = await ava.page
    .getByText(/already owns this document/i)
    .waitFor({ timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  ok("sharing with yourself is refused", selfRejected);

  await ava.page.getByLabel("Email of a seeded account").fill("cleo@ajaia.test");
  await ava.page.getByLabel("Access level").selectOption("VIEWER");
  await ava.page.getByRole("button", { name: "Share", exact: true }).last().click();
  await ava.page.getByText(/can now view this document/i).waitFor({ timeout: 15000 });
  ok("granting viewer access confirms in the UI", true);
  await shot(ava.page, "05-share-dialog");

  await ava.page.keyboard.press("Escape");
  await ava.page.waitForTimeout(500);
  ok(
    "Escape closes the share dialog",
    (await ava.page.getByRole("dialog", { name: "Sharing" }).count()) === 0,
  );
  await ava.page.getByRole("button", { name: "Share" }).click();
  await emailField.waitFor({ timeout: 15000 });
  ok("dialog reopens after Escape", true);

  // ---------------------------------------------------------- cleo: viewer
  cleo = await session("cleo");
  await signIn(cleo, "Cleo Marsh");
  ok(
    "recipient sees the document under 'Shared with me'",
    await cleo.page.getByText("Audit document").isVisible(),
  );
  ok("recipient sees a 'View only' badge", await cleo.page.getByText("View only").first().isVisible());
  ok(
    "recipient sees who owns it",
    await cleo.page.getByText(/Owner: Ava Chen/).first().isVisible(),
  );
  await shot(cleo.page, "06-dashboard-cleo-shared");

  await cleo.page.goto(docUrl);
  await cleo.page.waitForSelector(".ProseMirror", { timeout: 20000 });
  ok(
    "viewer gets no formatting toolbar",
    (await cleo.page.getByRole("toolbar", { name: "Formatting" }).count()) === 0,
  );
  ok(
    "viewer's editor is not editable",
    (await cleo.page.locator(".ProseMirror").getAttribute("contenteditable")) === "false",
  );
  ok("viewer's title field is disabled", await cleo.page.getByLabel("Document title").isDisabled());
  ok(
    "viewer sees no import control",
    (await cleo.page.getByRole("button", { name: /Import file/ }).count()) === 0,
  );
  ok(
    "viewer can still export",
    await cleo.page.getByRole("button", { name: "Export as Markdown" }).isVisible(),
  );
  ok(
    "viewer's share dialog is read-only ('Who has access')",
    await cleo.page.getByRole("button", { name: "Who has access" }).isVisible(),
  );
  ok(
    "viewer is offered no Delete control",
    (await cleo.page.getByRole("button", { name: "Delete" }).count()) === 0,
  );
  ok("viewer sees a 'View only' status", await cleo.page.getByText("View only").first().isVisible());
  await shot(cleo.page, "07-editor-cleo-readonly");

  // typing must not change anything
  const beforeText = await cleo.page.locator(".ProseMirror").textContent();
  await cleo.page.locator(".ProseMirror").click();
  await cleo.page.keyboard.type("SHOULD NOT APPEAR");
  await cleo.page.waitForTimeout(1200);
  ok(
    "typing as a viewer changes nothing",
    (await cleo.page.locator(".ProseMirror").textContent()) === beforeText,
  );
  ok(
    "viewer is shown no save-error box",
    (await cleo.page.getByText(/permission to do that/i).count()) === 0,
  );

  // --------------------------------------------------- upgrade to editor
  await ava.page.getByLabel("Access level").selectOption("EDITOR");
  await ava.page.getByLabel("Email of a seeded account").fill("cleo@ajaia.test");
  await ava.page.getByRole("button", { name: "Share", exact: true }).last().click();
  await ava.page.getByText(/can now edit this document/i).waitFor({ timeout: 15000 });

  await cleo.page.reload();
  await cleo.page.waitForSelector(".ProseMirror", { timeout: 20000 });
  ok(
    "after upgrade the editor toolbar appears",
    await cleo.page.getByRole("toolbar", { name: "Formatting" }).isVisible(),
  );
  await cleo.page.locator(".ProseMirror").click();
  await cleo.page.keyboard.press("Control+End");
  await cleo.page.keyboard.type(" edited-by-cleo");
  await cleo.page.getByText("All changes saved").waitFor({ timeout: 20000 });
  await cleo.page.waitForTimeout(1200);
  await cleo.page.reload();
  await cleo.page.waitForSelector(".ProseMirror", { timeout: 20000 });
  ok(
    "an editor's changes persist",
    (await cleo.page.locator(".ProseMirror").textContent())?.includes("edited-by-cleo"),
  );
  ok(
    "an editor still cannot manage sharing",
    (await cleo.page.getByRole("button", { name: "Who has access" }).count()) === 1,
  );

  // -------------------------------------------------------------- revoke
  await ava.page.getByRole("button", { name: "Remove" }).first().click();
  await ava.page.waitForTimeout(2500);
  await cleo.page.goto(`${BASE}/documents`);
  ok(
    "after revoke the document disappears from the recipient's dashboard",
    (await cleo.page.getByText("Audit document").count()) === 0,
  );
  await cleo.page.goto(docUrl);
  ok(
    "after revoke, opening the URL directly gives a not-found page",
    /not found|404/i.test((await cleo.page.textContent("body")) ?? ""),
  );
  await shot(cleo.page, "08-revoked-404");

  // --------------------------------------------------------- ben's seeds
  ben = await session("ben");
  await signIn(ben, "Ben Okafor");
  ok(
    "seeded editor/viewer split is visible for Ben",
    (await ben.page.getByText("Can edit").count()) >= 1 &&
      (await ben.page.getByText("View only").count()) >= 1,
  );
  await shot(ben.page, "09-dashboard-ben");

  // ------------------------------------------------------------ sign out
  await ben.page.getByRole("button", { name: "Sign out" }).click();
  await ben.page.waitForURL("**/signin", { timeout: 20000 });
  ok("sign out returns to the sign-in page", true);
  await ben.page.goto(`${BASE}/documents`);
  await ben.page.waitForURL("**/signin", { timeout: 20000 });
  ok("signed-out access to /documents redirects to sign-in", true);

  // -------------------------------------------------------------- delete
  await ava.page.goto(`${BASE}/documents`);
  await ready(ava.page);
  await ava.page.getByRole("button", { name: "New document" }).click();
  await ava.page.waitForURL(/\/documents\/[a-z0-9]+/);
  const doomedUrl = ava.page.url();
  await ava.page.waitForSelector(".ProseMirror", { timeout: 20000 });
  await ava.page.getByLabel("Document title").fill("Doomed document");
  await ava.page.getByText("All changes saved").waitFor({ timeout: 20000 });

  await ava.page.getByRole("button", { name: "Delete" }).click();
  const confirmText = await ava.page
    .getByRole("button", { name: "Cancel" })
    .waitFor({ timeout: 15000 })
    .then(() => ava.page.locator("span.text-red-800").first().textContent())
    .catch(() => null);
  ok(
    "Delete asks for confirmation before destroying anything",
    !!confirmText && /Doomed document/.test(confirmText),
    JSON.stringify(confirmText),
  );
  await shot(ava.page, "10-delete-confirm");

  await ava.page.getByRole("button", { name: "Cancel" }).click();
  await ava.page.waitForTimeout(400);
  ok("cancelling the confirmation keeps the document", ava.page.url() === doomedUrl);

  await ava.page.getByRole("button", { name: "Delete" }).click();
  await ava.page.getByRole("button", { name: "Delete", exact: true }).last().click();
  await ava.page.waitForURL("**/documents", { timeout: 20000 });
  ok("confirming Delete returns to the dashboard", true);
  await ava.page.waitForTimeout(1200);
  ok(
    "the deleted document is gone from the dashboard",
    (await ava.page.getByText("Doomed document").count()) === 0,
  );
  await ava.page.goto(doomedUrl);
  ok(
    "the deleted document's URL now 404s",
    /not found|404/i.test((await ava.page.textContent("body")) ?? ""),
  );

  // ------------------------------------------------- unknown document id
  await ava.page.goto(`${BASE}/documents/does-not-exist-at-all`);
  ok(
    "an unknown document id renders a not-found page",
    /not found|404/i.test((await ava.page.textContent("body")) ?? ""),
  );
} catch (e) {
  ok("audit script completed without throwing", false, String(e).split("\n")[0]);
} finally {
  for (const u of made) {
    const id = u.split("/").pop();
    await ava?.ctx.request.delete(`${BASE}/api/documents/${id}`).catch(() => {});
  }
  for (const f of [TMP_TXT, TMP_PNG]) {
    try {
      fs.unlinkSync(f);
    } catch {}
  }
  const errs = [...(ava?.errors ?? []), ...(ben?.errors ?? []), ...(cleo?.errors ?? [])].filter(
    (e) => !/favicon|React DevTools|Download the/i.test(e),
  );
  ok("no server errors or uncaught exceptions in any session", errs.length === 0, errs.slice(0, 4).join(" | "));
  await browser.close();
  console.log(results.join("\n"));
  const failed = results.filter((r) => r.startsWith("FAIL"));
  console.log(
    `\n${results.length - failed.length}/${results.length} passed` +
      (failed.length ? `\n=== ${failed.length} FAILED ===` : "\n=== ALL PASSED ==="),
  );
}
