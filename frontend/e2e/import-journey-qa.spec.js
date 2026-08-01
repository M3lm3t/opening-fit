/* global process */
import { expect, test } from "playwright/test";
import { SAMPLE_REPORT } from "../src/fixtures/sampleReport.js";

const appUrl = process.env.OPENINGFIT_E2E_URL;
test.skip(!appUrl, "Set OPENINGFIT_E2E_URL to a configured local preview.");

const jobId = "00000000-0000-0000-0000-000000000042";
const jobStartRoute = "**/api/analysis/jobs";
const jobStatusRoute = `**/api/analysis/jobs/${jobId}`;

function reportFixture({ games = 72, score = 72 } = {}) {
  return {
    ...SAMPLE_REPORT,
    sampleMode: false,
    sample_mode: false,
    isDemo: false,
    username: "JourneyPlayer",
    playerName: "JourneyPlayer",
    platform: "chess.com",
    source: "chesscom",
    importPlatform: "chesscom",
    gamesImported: games,
    gamesFound: games,
    gamesAnalysed: games,
    openingFitScore: score,
    gameCounts: {
      fetchedGames: games,
      dateRangeEligibleGames: games,
      timeControlEligibleGames: games,
      analysisCandidateGames: games,
      analysedGames: games,
      excludedGames: 0,
    },
  };
}

function caroPriorityReport() {
  const priority = {
    schemaVersion: 1,
    priorityId: "training-caro-kann:played-as-black",
    taskId: "training-caro-kann:played-as-black",
    recommendationId: "caro-kann:played_as_black",
    openingName: "Caro-Kann Defence",
    openingKey: "caro-kann-defense",
    role: "played_as_black",
    playerColour: "black",
    taskType: "game_review",
    actionType: "repair_repertoire",
    title: "Practise Caro-Kann Defence",
    rationale: "Twelve opening-specific games make this the clearest current repair priority.",
    evidenceCount: 12,
    evidenceGameIds: [],
    estimatedDurationMinutes: 10,
    successCheck: "Record one safer plan for the first unclear position.",
    confidenceStatus: "medium",
    sourceReportId: "analysis-caro",
    fallback: false,
    fallbackReason: null,
  };
  const recommendation = {
    recommendationId: "caro-kann:played_as_black",
    opening: "Caro-Kann Defence",
    openingName: "Caro-Kann Defence",
    openingId: "caro-kann-defense",
    role: "played_as_black",
    verdict: "repair",
    sample: { games: 12, wins: 3, draws: 2, losses: 7, scoreRate: 33.3 },
    trainingAction: { title: "Repair Caro-Kann Defence", explanation: priority.rationale },
  };
  const reportDecision = {
    schemaVersion: 2,
    recommendations: [recommendation],
    establishedStrength: null,
    primaryProblem: recommendation,
    nextTrainingAction: {
      type: "repair_repertoire",
      recommendationId: "caro-kann:played_as_black",
      opening: "Caro-Kann Defence",
      role: "played_as_black",
      label: "Repair Caro-Kann Defence",
      reason: priority.rationale,
      sample: { games: 12 },
    },
    trainingPriority: priority,
  };
  return {
    ...reportFixture({ games: 280, score: 63 }),
    analysisId: "analysis-caro",
    gamesImported: 311,
    gamesFound: 311,
    gamesAnalysed: 280,
    reportDecision,
    report_decision: reportDecision,
    trainingPriority: priority,
    training_priority: priority,
  };
}

async function prepareVisitor(page, viewport = { width: 1440, height: 900 }) {
  await page.setViewportSize(viewport);
  await page.addInitScript(() => localStorage.clear());
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Stop guessing which chess openings you should play." })).toBeVisible();
  const trustNote = page.getByText("No password required", { exact: true });
  await expect(trustNote).toBeVisible();
  await expect(trustNote).toHaveJSProperty("tagName", "LI");
  await expect(trustNote).not.toHaveAttribute("tabindex");
}

async function startImport(page, username = "JourneyPlayer") {
  await page.getByLabel(/Chess\.com username/i).fill(username);
  await page.getByRole("button", { name: "Get my opening report" }).click();
}

function routeJob(page, states) {
  let poll = 0;
  const context = page.context();
  return Promise.all([
    context.route(jobStartRoute, async (route) => {
      if (route.request().method() !== "POST") {
        await route.fallback();
        return;
      }
      await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ jobId, status: "queued", progress: { stage: "queued", counts: {} } }) });
    }),
    context.route(jobStatusRoute, async (route) => {
      if (route.request().method() !== "GET") {
        await route.fallback();
        return;
      }
      const state = states[Math.min(poll, states.length - 1)];
      poll += 1;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ jobId, ...state }) });
    }),
  ]);
}

test("signed-out example refresh stays fictional and preserves a genuine local report", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  const genuinePayload = JSON.stringify({
    username: "SafeLocalPlayer",
    platform: "chess.com",
    savedAt: "2026-07-29T10:00:00Z",
    analysis: { analysisCompleted: true, username: "SafeLocalPlayer", platform: "chess.com", gamesAnalysed: 8 },
  });
  await page.evaluate((payload) => localStorage.setItem("openingFit:lastAnalysis", payload), genuinePayload);

  await page.getByRole("button", { name: "Open full example report" }).click();
  await expect(page).toHaveURL(/\/report\/sample$/);
  await expect(page.locator('[data-report-kind="sample"]')).toBeVisible();
  await expect(page.getByText("Illustrative example", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Fictional data for a fictional player/).first()).toBeVisible();
  await expect(page.getByText(/will not be saved to your history/).first()).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("openingFit:lastAnalysis"))).toBe(genuinePayload);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-report-kind="sample"]')).toBeVisible();
  await expect(page.getByText("Illustrative example", { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("openingFit:lastAnalysis"))).toBe(genuinePayload);

  await page.getByRole("button", { name: "Analyse your games" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => localStorage.getItem("openingFit:lastAnalysis"))).toBe(genuinePayload);
});

test("signed-out visitor sees readable real progress before a many-game report", async ({ page }) => {
  await routeJob(page, [
    { status: "running", progress: { stage: "requesting_public_games", counts: { archivesProcessed: 0, archivesTotal: 3, fetchedGames: 0 } } },
    { status: "running", progress: { stage: "requesting_public_games", counts: { archivesProcessed: 1, archivesTotal: 3, fetchedGames: 24 } } },
    { status: "running", progress: { stage: "requesting_public_games", counts: { archivesProcessed: 3, archivesTotal: 3, fetchedGames: 72 } } },
    { status: "running", progress: { stage: "identifying_openings", counts: { fetchedGames: 72, analysedGames: 72, processedGames: 36 } } },
    { status: "running", progress: { stage: "building_recommendations", counts: { fetchedGames: 72, analysedGames: 72 } } },
    { status: "completed", progress: { stage: "finishing_report", counts: { fetchedGames: 72, analysedGames: 72 } }, result: reportFixture() },
  ]);
  await prepareVisitor(page);
  await startImport(page);

  const overlay = page.locator(".importLoadingOverlay");
  await expect(overlay.getByRole("heading", { name: "Building your OpeningFit report" })).toBeVisible();
  await expect(overlay.locator(".importLoadingActiveMessage p")).toHaveText(/Checking 1 of 3 monthly archives/i);
  await expect(overlay.locator(".importLoadingActiveMessage p")).toHaveText(/24 games found so far/i, { timeout: 5000 });
  await expect(overlay.locator(".importLoadingActiveMessage p")).toHaveText(/Processing game 36 of 72/i, { timeout: 7000 });
  await expect(overlay.getByText("Building your recommendations", { exact: true }).first()).toBeVisible({ timeout: 9000 });
  await expect(page.locator(".reportPageTitle")).toBeVisible({ timeout: 12000 });
  await expect(page.locator(".reportPageTitle")).toBeFocused();
  await expect(overlay).toHaveCount(0);
});

test("unknown and slow work stays indeterminate, reassures, and cancels cleanly", async ({ page }) => {
  await routeJob(page, [{ status: "running", progress: { stage: "requesting_public_games", counts: {} } }]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await prepareVisitor(page, { width: 390, height: 844 });
  await startImport(page, "SlowJourneyPlayer");
  const progress = page.getByRole("progressbar");
  await expect(progress).toBeVisible();
  await expect(progress).not.toHaveAttribute("aria-valuenow");
  await expect(progress.locator("span")).toHaveCSS("animation-name", "none");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByText(/Still working — larger game histories/i)).toBeVisible({ timeout: 9000 });
  await page.getByRole("button", { name: "Cancel analysis" }).click();
  await expect(page.locator(".importLoadingOverlay")).toHaveCount(0);
});

test("few and empty completed imports resolve without an endless loading state", async ({ page }) => {
  await routeJob(page, [{ status: "completed", progress: { stage: "finishing_report", counts: { fetchedGames: 4, analysedGames: 4 } }, result: reportFixture({ games: 4, score: 63 }) }]);
  await prepareVisitor(page, { width: 768, height: 1024 });
  await startImport(page, "FewGamesPlayer");
  await expect(page.locator(".reportPageTitle")).toBeVisible({ timeout: 5000 });
  await expect(page.locator(".primaryReportConfidence")).toContainText("Confidence is still developing");

  await page.context().unroute(jobStartRoute);
  await page.context().unroute(jobStatusRoute);
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await routeJob(page, [{ status: "completed", progress: { stage: "finishing_report", counts: { fetchedGames: 0, analysedGames: 0 } }, result: { username: "NoGamesPlayer", platform: "chess.com", gamesImported: 0, gamesFound: 0, gamesAnalysed: 0 } }]);
  await startImport(page, "NoGamesPlayer");
  await expect(page.locator(".importLoadingOverlay")).toHaveCount(0, { timeout: 5000 });
  await expect(page.getByRole("button", { name: "Switch platform" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open example report" })).toBeVisible();
});

test("failed import leaves a correction or retry action", async ({ page }) => {
  await routeJob(page, [{ status: "failed", progress: { stage: "requesting_public_games", counts: {} }, error: { status: 502, message: "Chess.com could not return all selected monthly game archives." } }]);
  await prepareVisitor(page, { width: 320, height: 568 });
  await startImport(page, "FailedJourneyPlayer");
  await expect(page.locator(".importLoadingOverlay")).toHaveCount(0, { timeout: 5000 });
  await expect(page.getByRole("button", { name: "Retry analysis" })).toBeVisible();
});

test("the report priority survives navigation and a direct signed-out reload of train", async ({ page }) => {
  await routeJob(page, [{
    status: "completed",
    progress: { stage: "finishing_report", counts: { fetchedGames: 311, analysedGames: 280 } },
    result: caroPriorityReport(),
  }]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Stop guessing which chess openings you should play." })).toBeVisible();
  await startImport(page, "PriorityJourneyPlayer");

  const action = page.getByRole("heading", { name: "This week: practise Caro-Kann Defence for approximately 10 minutes." }).first();
  await expect(action).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: "Start 10-minute practice" }).click();
  await expect(page).toHaveURL(/\/train$/);
  await expect(page.getByRole("heading", { name: "This week: practise Caro-Kann Defence for approximately 10 minutes." })).toBeVisible();
  await expect(page.getByText(/Twelve opening-specific games make this the clearest current repair priority/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Start free action" })).toHaveCount(0);
  await expect(page.getByText(/General setup guidance; no recoverable source game is claimed/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Open source game" })).toHaveCount(0);
  await page.getByRole("button", { name: "Continue to game review" }).click();
  await page.getByRole("button", { name: "Continue to concept" }).click();
  const choices = page.locator(".openingConceptOptions button");
  await expect(choices).toHaveCount(3);
  await choices.first().click();
  await page.getByRole("button", { name: /Concept Completed.*reopen step/ }).click();
  await expect(page.getByText("Why variation-specific commitment is premature", { exact: true })).toBeVisible();
  await expect(page.locator(".openingOpportunityFeedback")).toContainText(/coordinates development, central control, and king safety/i);
  await expect(page.getByText(/Only 311 recent games/i)).toHaveCount(0);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/train$/);
  await expect(page.getByRole("heading", { name: "This week: practise Caro-Kann Defence for approximately 10 minutes." })).toBeVisible();
  await expect(page.getByText(/Vienna Game/)).toHaveCount(0);
});
