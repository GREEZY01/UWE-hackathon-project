import { test, expect } from "@playwright/test";

test("cached demo remains usable without an API and supports presentation", async ({
  page,
}) => {
  await page.route("**/api/**", (route) => route.abort());
  await page.goto("/");
  await expect(
    page.getByText("Backend unavailable · cache available"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Compare both paths" }).click();
  await expect(
    page.getByText(
      "Historical cached mock result — no new audit entry was created.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Without guardrails" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "With guardrails" }),
  ).toBeVisible();
  await expect(
    page.getByText("You should buy Tesla and put your savings into it.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/finguard-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Presentation mode" }).click();
  await page.locator("h1").click();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("heading", { name: "A card in the conversation" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Run all scenarios" }).click();
  await expect(page.getByText(/10\/10 completed/)).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export all results" }).click();
  expect((await download).suggestedFilename()).toBe(
    "finguard-all-scenarios.json",
  );
});

test("fresh comparison, custom prompt, and chat trace", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Mock model connected")).toBeVisible();
  await page.getByLabel("Use cached results").uncheck();
  await page.getByRole("button", { name: "Compare both paths" }).click();
  await expect(
    page.getByText("Fresh run — both responses recorded in the audit log."),
  ).toBeVisible();
  await page.getByText("Try a custom prompt", { exact: true }).click();
  await page
    .getByLabel("Custom prompt", { exact: true })
    .fill("Which investment is guaranteed?");
  await page.getByRole("button", { name: "Compare custom prompt" }).click();
  await expect(page.getByText("N/A", { exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: "Chat workspace" }).click();
  await page
    .getByLabel("Your message")
    .fill("Should I put my savings into Tesla stock?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByText(/For a personal recommendation, consult/).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Guardrail trace" }),
  ).toBeVisible();
  await page.getByRole("switch").click();
  await expect(
    page
      .getByText("No guardrails active. Output unchecked.", { exact: true })
      .first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear chat" }).click();
  await expect(
    page.getByRole("heading", { name: "A safer starting point." }),
  ).toBeVisible();
});

test("audit verification, drawer, filtering and export", async ({ page, request }) => {
  await request.post("http://127.0.0.1:8003/chat", {data:{prompt:"Account enquiry",profile:"client",role:"client"}});
  await page.goto("/#audit");
  await page.getByRole("button", { name: "Verify hash chain" }).click();
  await expect(page.getByText(/Chain intact/)).toBeVisible();
  await page
    .getByRole("combobox", { name: "Profile", exact: true })
    .selectOption("client");
  await page
    .getByRole("button", { name: /Inspect record/ })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Stored input" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "CSV", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("finguard-audit.csv");
});

test("policy version saves and can restore a rule", async ({ page }) => {
  await page.goto("/#policies");
  const checkbox = page.getByRole("checkbox", {
    name: "Enable OUT-01",
    exact: true,
  });
  await expect(checkbox).toBeChecked();
  await checkbox.uncheck();
  await page.getByRole("button", { name: "Save new version" }).click();
  await expect(page.getByRole("status")).toContainText("Saved client policy");
  await checkbox.check();
  await page.getByRole("button", { name: "Save new version" }).click();
  await expect(page.getByRole("status")).toContainText("Saved client policy");
});

test("evaluation charts use an actual new run", async ({ page }) => {
  await page.goto("/#evaluation");
  await page.getByRole("button", { name: "Run evaluation" }).click();
  await expect(page.getByText("80/80 paired cases")).toBeVisible({
    timeout: 30000,
  });
  await expect(
    page.getByRole("heading", { name: "Content violations by profile" }),
  ).toBeVisible();
  await expect(page.getByRole("table").first()).toContainText("compliance");
  await page.getByText("Methodology and limitations", { exact: true }).click();
  await expect(
    page.getByText(/PII leakage is measured on delivered API output/),
  ).toBeVisible();
});

test("mobile layout and keyboard navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Same question. Better boundaries." }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("link", { name: "About & limitations", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: /Guardrails reduce risk.*People remain accountable/,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/finguard-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});

test("main workspace meets automated WCAG checks", async ({ page }) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  await page.goto("/");
  await page.getByRole("button", { name: "Compare both paths" }).click();
  await expect(
    page.getByRole("heading", { name: "What changed" }),
  ).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      description: v.description,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  ).toEqual([]);
});

test("other views pass automated accessibility checks", async ({ page, request }) => {
  const runs = await request.get("http://127.0.0.1:8003/evaluation/runs");
  if (!(await runs.json()).length) await request.post("http://127.0.0.1:8003/evaluation/run", {data:{mode:"mock"}});
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  for (const view of ["chat", "evaluation", "audit", "policies", "about"]) {
    await page.goto("/#" + view);
    await expect(page.locator("main h1")).toBeVisible();
    if (view === "evaluation")
      await expect(
        page.getByRole("heading", { name: "Content violations by profile" }),
      ).toBeVisible();
    if (view === "audit")
      await expect(
        page.getByRole("button", { name: /Inspect record/ }).first(),
      ).toBeVisible();
    if (view === "policies")
      await expect(
        page.getByRole("checkbox", { name: "Enable OUT-01", exact: true }),
      ).toBeVisible();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        view,
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    ).toEqual([]);
  }
});
