/**
 * End-to-end UI check against a running server.
 *
 * The vitest suite covers the pure domain layer; this covers the things only a
 * real browser can prove: that the editor hydrates, that formatting survives a
 * round-trip through the database, and that a viewer genuinely cannot edit.
 *
 * Usage:  npm run build && npm start   (in one terminal)
 *         npm run verify:ui            (in another)
 */
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const SAMPLE_FILE = fileURLToPath(
  new URL("../samples/sample-import.md", import.meta.url),
);
const results = [];
const ok = (name, pass, extra = "") =>
  results.push(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? " :: " + extra : ""}`);

const browser = await chromium.launch();

async function session() {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.url().includes("/api/") && !r.ok())
      errors.push(`HTTP ${r.status()} ${r.request().method()} ${r.url()}`);
  });
  return { ctx, page, errors };
}

let ava, cleo, docUrl;
try {
  ava = await session();
  await ava.page.goto(`${BASE}/signin`);
  await ava.page.getByText("Ava Chen").click();
  await ava.page.waitForURL("**/documents");
  ok("sign-in navigates to dashboard", true);

  await ava.page.getByRole("button", { name: "New document" }).click();
  await ava.page.waitForURL(/\/documents\/[a-z0-9]+/);
  docUrl = ava.page.url();

  await ava.page.waitForSelector(".ProseMirror", { timeout: 15000 });
  ok("editor hydrated (.ProseMirror mounted)", true);

  const body = ava.page.locator(".ProseMirror");
  ok(
    "toolbar rendered",
    await ava.page.getByRole("toolbar", { name: "Formatting" }).isVisible(),
  );

  await body.click();
  await ava.page.keyboard.type("Heading here");
  await ava.page.getByRole("button", { name: "Heading 1" }).click();
  await ava.page.keyboard.press("End");
  await ava.page.keyboard.press("Enter");
  // Keyboard shortcut rather than a toolbar click: the toolbar's active state is
  // asserted separately below, and shortcuts are the path users actually take.
  await ava.page.keyboard.press("Control+b");
  await ava.page.keyboard.type("bold bit");
  ok(
    "toolbar reflects active mark",
    (await ava.page
      .getByRole("button", { name: /^Bold/ })
      .getAttribute("aria-pressed")) === "true",
  );
  await ava.page.keyboard.press("Control+b");
  await ava.page.keyboard.press("Enter");
  await ava.page.getByRole("button", { name: "Bulleted list" }).click();
  await ava.page.keyboard.type("item one");

  const beforeHtml = await body.innerHTML();
  ok("h1 applied", (await body.locator("h1").count()) > 0, beforeHtml.slice(0, 200));
  ok("bold applied", (await body.locator("strong").count()) > 0);
  ok("bullet list applied", (await body.locator("ul li").count()) > 0);

  const title = ava.page.getByLabel("Document title");
  await title.fill("Playwright verified doc");

  // Wait for a real save: status must leave the dirty state after our edits.
  await ava.page.getByText("Saving…").waitFor({ timeout: 8000 }).catch(() => {});
  await ava.page
    .getByText("All changes saved")
    .waitFor({ timeout: 15000 });
  await ava.page.waitForTimeout(1500);
  ok("autosave reached saved state", true);

  await ava.page.reload();
  await ava.page.waitForSelector(".ProseMirror", { timeout: 15000 });
  await ava.page.waitForTimeout(1000);
  const afterHtml = await body.innerHTML();
  ok(
    "formatting survives reload",
    (await body.locator("h1").count()) > 0 &&
      (await body.locator("strong").count()) > 0 &&
      (await body.locator("ul li").count()) > 0,
    afterHtml.slice(0, 300),
  );
  ok(
    "title persisted",
    (await title.inputValue()) === "Playwright verified doc",
    await title.inputValue(),
  );

  await ava.page.setInputFiles(
    'input[type="file"]',
    SAMPLE_FILE,
  );
  // Poll rather than sleep: the import round-trips through the server, so a
  // fixed wait is a race.
  const imported = await ava.page
    .waitForFunction(
      () => document.querySelectorAll(".ProseMirror h1").length >= 2,
      undefined,
      { timeout: 20000 },
    )
    .then(() => true)
    .catch(() => false);
  ok(
    "import appended into open document",
    imported,
    `h1 count=${await body.locator("h1").count()}`,
  );

  await ava.page.getByRole("button", { name: "Share" }).click();
  await ava.page.getByLabel("Email of a seeded account").fill("cleo@ajaia.test");
  await ava.page.getByLabel("Access level").selectOption("VIEWER");
  await ava.page.getByRole("button", { name: "Share", exact: true }).last().click();
  await ava.page.getByText(/can now view this document/i).waitFor({ timeout: 10000 });
  ok("share succeeded with confirmation", true);

  cleo = await session();
  await cleo.page.goto(`${BASE}/signin`);
  await cleo.page.getByText("Cleo Marsh").click();
  await cleo.page.waitForURL("**/documents");
  ok(
    "shared doc appears for recipient",
    await cleo.page.getByText("Playwright verified doc").isVisible(),
  );
  ok(
    "view-only badge shown",
    await cleo.page.getByText("View only").first().isVisible(),
  );

  await cleo.page.goto(docUrl);
  await cleo.page.waitForSelector(".ProseMirror", { timeout: 15000 });
  ok(
    "recipient sees no formatting toolbar",
    (await cleo.page.getByRole("toolbar", { name: "Formatting" }).count()) === 0,
  );
  ok(
    "editor not editable for viewer",
    (await cleo.page.locator(".ProseMirror").getAttribute("contenteditable")) ===
      "false",
  );
  ok(
    "title input disabled for viewer",
    await cleo.page.getByLabel("Document title").isDisabled(),
  );
} catch (e) {
  ok("script completed without throwing", false, String(e).split("\n")[0]);
} finally {
  if (docUrl && ava) {
    const id = docUrl.split("/").pop();
    await ava.page
      .evaluate((d) => fetch(`/api/documents/${d}`, { method: "DELETE" }), id)
      .catch(() => {});
  }
  const allErrors = [...(ava?.errors ?? []), ...(cleo?.errors ?? [])].filter(
    (e) => !/favicon|React DevTools/i.test(e),
  );
  ok("no uncaught browser errors", allErrors.length === 0, allErrors.slice(0, 4).join(" | "));
  await browser.close();
  console.log(results.join("\n"));
  console.log(
    results.some((r) => r.startsWith("FAIL"))
      ? "\n=== SOME CHECKS FAILED ==="
      : "\n=== ALL CHECKS PASSED ===",
  );
}
