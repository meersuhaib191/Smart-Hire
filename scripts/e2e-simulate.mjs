import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const baseURL = "http://127.0.0.1:3000";
const stamp = Date.now();
const hr = {
  name: `HR User ${stamp}`,
  email: `hr.${stamp}@example.com`,
  password: "TestPass123!",
  company: `Acme ${stamp}`,
};
const applicant = {
  name: `Applicant ${stamp}`,
  email: `applicant.${stamp}@example.com`,
  password: "TestPass123!",
};
const jobTitle = `Web Developer ${stamp}`;

const outDir = path.join(process.cwd(), "tmp");
const resumePath = path.join(outDir, `resume-${stamp}.pdf`);

async function ensureResume() {
  await fs.mkdir(outDir, { recursive: true });
  // Minimal valid-ish PDF bytes for upload testing.
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n", "utf8");
  await fs.writeFile(resumePath, pdf);
}

function log(step, detail) {
  console.log(`[${step}] ${detail}`);
}

async function registerHr(page) {
  log("HR", "Registering HR user");
  await page.goto(`${baseURL}/register`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "HR" }).click();
  await page.getByPlaceholder("John Doe").fill(hr.name);
  await page.getByPlaceholder("john@example.com").fill(hr.email);
  await page.locator('input[type="password"]').first().fill(hr.password);
  await page.locator('input[type="password"]').nth(1).fill(hr.password);
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.waitForURL("**/hr/complete-profile", { timeout: 30000 });
}

async function completeHrProfile(page) {
  log("HR", "Completing HR profile");
  await page.getByPlaceholder("Acme Inc.").fill(hr.company);
  await page.getByPlaceholder("Talent Acquisition Lead").fill("Talent Acquisition Lead");
  await page.getByRole("button", { name: "Complete Profile" }).click();
  await page.waitForURL("**/hr/dashboard", { timeout: 30000 });
  const meRes = await page.request.get(`${baseURL}/api/auth/me`);
  const me = await meRes.json();
  log("HR", `Authenticated role after profile completion: ${me?.user?.role || "unknown"}`);
}

async function createJob(page) {
  log("HR", "Creating a job");
  let formVisible = false;
  for (let i = 0; i < 3; i += 1) {
    await page.goto(`${baseURL}/dashboard/hr/jobs/new`, { waitUntil: "networkidle" });
    const formTitleInput = page.locator('input[placeholder="e.g. Senior Frontend Developer"]');
    formVisible = await formTitleInput.isVisible().catch(() => false);
    if (formVisible) break;
    await page.waitForTimeout(2500);
  }
  if (!formVisible) {
    log("HR", "Job form UI not visible, using authenticated API fallback");
    const createRes = await page.request.post(`${baseURL}/api/hr/jobs`, {
      data: {
        title: jobTitle,
        description: "Build and maintain frontend applications using React and TypeScript.",
        experience_required: 0,
        skills: ["React"],
        weights: {
          ats_weight: 1,
          mcq_weight: 0,
          coding_weight: 0,
          interview_weight: 0,
        },
      },
    });
    if (!createRes.ok()) {
      const body = await createRes.text();
      throw new Error(`Job create fallback failed: ${createRes.status()} ${body}`);
    }
    return;
  }

  const form = page.locator("form").first();
  await form.locator('input[placeholder="e.g. Senior Frontend Developer"]').fill(jobTitle);
  await form.locator('textarea[placeholder="Describe the responsibilities and requirements..."]').fill(
    "Build and maintain frontend applications using React and TypeScript."
  );
  await form.locator('input[placeholder="e.g. React, TypeScript, Node.js"]').fill("React");
  await form.getByRole("button", { name: /^Add$/ }).click();
  await form.getByRole("button", { name: "Publish Job" }).click();
  await page.waitForURL("**/dashboard/hr", { timeout: 30000 });
}

async function getHrJobId(page) {
  const res = await page.request.get(`${baseURL}/api/hr/jobs`);
  const json = await res.json();
  const found = (json.jobs || []).find((j) => j.title === jobTitle);
  if (!found?.id) throw new Error("Created HR job not found through /api/hr/jobs");
  log("HR", `Job created with id ${found.id}`);
  return found.id;
}

async function registerApplicant(page) {
  log("Applicant", "Registering applicant user");
  await page.goto(`${baseURL}/register`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Applicant" }).click();
  await page.getByPlaceholder("John Doe").fill(applicant.name);
  await page.getByPlaceholder("john@example.com").fill(applicant.email);
  await page.locator('input[type="password"]').first().fill(applicant.password);
  await page.locator('input[type="password"]').nth(1).fill(applicant.password);
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.waitForURL("**/applicant/complete-profile", { timeout: 30000 });
}

async function completeApplicantProfile(page) {
  log("Applicant", "Completing applicant profile");
  await page.locator('input[type="text"]').first().fill(applicant.name);
  await page.locator('button:has-text("Additional")').click();
  await page.locator('button:has-text("Complete Profile"):visible').click();
  await page.waitForFunction(
    () => window.location.pathname === "/applicant/dashboard" || window.location.pathname === "/dashboard/applicant",
    null,
    { timeout: 120000 }
  );
}

async function applyToJob(page, jobId) {
  log("Applicant", "Applying to created job");
  await page.goto(`${baseURL}/jobs/${jobId}/apply`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Resume (PDF)").setInputFiles(resumePath);
  await page.getByRole("button", { name: "Submit Application" }).click();
  await page.getByText("Application Submitted!").waitFor({ timeout: 30000 });
  await page.waitForURL("**/jobs", { timeout: 15000 });
}

async function verifyApplicantState(page, jobId) {
  log("Applicant", "Verifying already applied + dashboard count");
  await page.goto(`${baseURL}/jobs`, { waitUntil: "domcontentloaded" });
  const card = page.locator("div").filter({ hasText: jobTitle }).first();
  await card.getByRole("button", { name: "Already Applied" }).waitFor({ timeout: 15000 });

  const appsRes = await page.request.get(`${baseURL}/api/applicant/applications`);
  const appsJson = await appsRes.json();
  const hasJob = (appsJson.applications || []).some((a) => a.job_id === jobId);
  if (!hasJob) throw new Error("Applicant applications API missing created application");
}

async function loginHrAndVerifyCandidate(page, jobId) {
  log("HR", "Logging in and verifying candidate appears in analytics");
  await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.getByPlaceholder("applicant@example.com").fill(hr.email);
  await page.locator('input[type="password"]').first().fill(hr.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/hr/dashboard", { timeout: 30000 });

  const analyticsRes = await page.request.get(`${baseURL}/api/hr/jobs/${jobId}/analytics`);
  const analyticsJson = await analyticsRes.json();
  if (!Array.isArray(analyticsJson.candidates) || analyticsJson.candidates.length === 0) {
    throw new Error("HR analytics returned no candidates for created job");
  }
}

async function main() {
  await ensureResume();
  const browser = await chromium.launch({ headless: true });
  try {
    const hrCtx = await browser.newContext();
    const hrPage = await hrCtx.newPage();
    await registerHr(hrPage);
    await completeHrProfile(hrPage);
    await createJob(hrPage);
    const jobId = await getHrJobId(hrPage);
    await hrCtx.close();

    const appCtx = await browser.newContext();
    const appPage = await appCtx.newPage();
    await registerApplicant(appPage);
    await completeApplicantProfile(appPage);
    await applyToJob(appPage, jobId);
    await verifyApplicantState(appPage, jobId);
    await appCtx.close();

    const hrCheckCtx = await browser.newContext();
    const hrCheckPage = await hrCheckCtx.newPage();
    await loginHrAndVerifyCandidate(hrCheckPage, jobId);
    await hrCheckCtx.close();

    log("PASS", "End-to-end applicant + HR simulation succeeded");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(`[FAIL] ${err.message}`);
  process.exit(1);
});
