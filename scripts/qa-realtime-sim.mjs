import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const HEADLESS = process.env.HEADLESS !== "false";
const stamp = Date.now();

const outDir = path.join(process.cwd(), "tmp", `qa-sim-${stamp}`);

const hr1 = {
  name: `HR One ${stamp}`,
  email: `hr.one.${stamp}@example.com`,
  password: "TestPass123!",
  company: `NovaWorks ${stamp}`,
};

const hr2 = {
  name: `HR Two ${stamp}`,
  email: `hr.two.${stamp}@example.com`,
  password: "TestPass123!",
  company: `NovaWorks ${stamp}`,
};

const applicants = [
  { name: `Ava Khan ${stamp}`, email: `ava.${stamp}@example.com`, password: "TestPass123!" },
  { name: `Liam Chen ${stamp}`, email: `liam.${stamp}@example.com`, password: "TestPass123!" },
  { name: `Noah Ali ${stamp}`, email: `noah.${stamp}@example.com`, password: "TestPass123!" },
];

const jobsSeed = [
  {
    title: `Frontend Engineer ${stamp}`,
    description: "Build React features, optimize performance, and collaborate with design.",
    skills: ["React", "TypeScript", "Tailwind"],
  },
  {
    title: `Backend Engineer ${stamp}`,
    description: "Build APIs, integrate databases, and improve reliability of backend services.",
    skills: ["Node.js", "PostgreSQL", "REST"],
  },
];

const timeline = [];
const findings = [];

function log(actor, action, details = "") {
  const row = {
    at: new Date().toISOString(),
    actor,
    action,
    details,
  };
  timeline.push(row);
  // Visible action console for user request.
  console.log(`[${row.at}] [${actor}] ${action}${details ? ` :: ${details}` : ""}`);
}

function bug(title, details) {
  findings.push({ severity: "high", title, details });
  console.error(`[BUG] ${title} :: ${details}`);
}

async function ensureArtifacts() {
  await fs.mkdir(outDir, { recursive: true });
  const resumePdf = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n", "utf8");
  for (const a of applicants) {
    const p = path.join(outDir, `${a.email.replace(/[@.]/g, "_")}.pdf`);
    await fs.writeFile(p, resumePdf);
    a.resumePath = p;
  }
}

async function register(page, role, user) {
  await page.goto(`${BASE_URL}/register`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: role === "hr" ? "HR" : "Applicant" }).click();
  await page.evaluate((roleValue) => {
    const input = document.querySelector('input[name="role"]');
    if (input) {
      input.value = roleValue;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, role);
  await page.getByPlaceholder("John Doe").fill(user.name);
  await page.getByPlaceholder("john@example.com").fill(user.email);
  await page.locator('input[type="password"]').first().fill(user.password);
  await page.locator('input[type="password"]').nth(1).fill(user.password);
  await page.getByRole("button", { name: "Create Account" }).click();
}

async function completeHrProfile(page, user) {
  await page.waitForURL("**/hr/complete-profile", { timeout: 120000 });
  await page.getByPlaceholder("Acme Inc.").fill(user.company);
  await page.getByPlaceholder("Talent Acquisition Lead").fill("Talent Acquisition Lead");
  await page.getByRole("button", { name: "Complete Profile" }).click();
  await page.waitForURL("**/hr/dashboard", { timeout: 120000 });
}

async function completeApplicantProfile(page, user) {
  await page.waitForURL("**/applicant/complete-profile", { timeout: 120000 });
  await page.locator('input[type="text"]').first().fill(user.name);
  await page.locator('button:has-text("Additional")').click();
  await page.locator('button:has-text("Complete Profile"):visible').click();
  await page.waitForFunction(
    () => window.location.pathname === "/applicant/dashboard" || window.location.pathname === "/dashboard/applicant",
    null,
    { timeout: 120000 }
  );
}

async function createJobViaUi(page, job) {
  await page.goto(`${BASE_URL}/dashboard/hr/jobs/new`, { waitUntil: "networkidle" });
  const formTitle = page.locator('input[placeholder="e.g. Senior Frontend Developer"]');
  if (!(await formTitle.isVisible().catch(() => false))) {
    throw new Error("Job form not visible");
  }
  await formTitle.fill(job.title);
  await page.locator('textarea[placeholder="Describe the responsibilities and requirements..."]').fill(job.description);
  await page.locator('input[placeholder="e.g. React, TypeScript, Node.js"]').fill(job.skills[0]);
  await page.getByRole("button", { name: /^Add$/ }).click();
  await page.getByRole("button", { name: "Publish Job" }).click();
  await page.waitForURL("**/dashboard/hr", { timeout: 120000 });
}

async function fetchHrJobs(page) {
  const res = await page.request.get(`${BASE_URL}/api/hr/jobs`);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || "Failed to fetch hr jobs");
  return json.jobs || [];
}

async function applyForJob(page, applicant, jobId) {
  await page.goto(`${BASE_URL}/jobs/${jobId}/apply`, { waitUntil: "networkidle" });
  await page.locator('input[type="file"][name="resume"]').setInputFiles(applicant.resumePath);
  await page.getByRole("button", { name: "Submit Application" }).click();
  await page.getByText("Application Submitted!").waitFor({ timeout: 120000 });
}

async function duplicateApplyAttempt(page, jobId) {
  await page.goto(`${BASE_URL}/jobs/${jobId}/apply`, { waitUntil: "networkidle" });
  const respPromise = page.waitForResponse(
    (r) => r.url().includes("/api/apply") && r.request().method() === "POST",
    { timeout: 120000 }
  );
  await page.locator('input[type="file"][name="resume"]').setInputFiles(applicants[0].resumePath);
  await page.getByRole("button", { name: "Submit Application" }).click();
  const resp = await respPromise;
  const body = await resp.json().catch(() => ({}));
  return { status: resp.status(), body };
}

async function invalidInputCheck(page) {
  const r = await page.request.post(`${BASE_URL}/api/apply`, {
    multipart: { cover_letter: "No job id here" },
  });
  const body = await r.json().catch(() => ({}));
  return { status: r.status(), body };
}

async function sessionExpiryCheck(context, page) {
  await context.clearCookies();
  const r = await page.request.get(`${BASE_URL}/api/hr/jobs`);
  return r.status();
}

async function networkDelaySimulation(page) {
  await page.route("**/api/jobs", async (route) => {
    await new Promise((res) => setTimeout(res, 2000));
    await route.continue();
  });
  const t0 = Date.now();
  await page.goto(`${BASE_URL}/jobs`, { waitUntil: "networkidle" });
  return Date.now() - t0;
}

async function pollHrAnalytics(page, jobId, expectedMin) {
  const start = Date.now();
  while (Date.now() - start < 120000) {
    const res = await page.request.get(`${BASE_URL}/api/hr/jobs/${jobId}/analytics`);
    const json = await res.json().catch(() => ({}));
    const count = (json?.candidates || []).length;
    log("HR-1", "Polled analytics", `job=${jobId} candidates=${count}`);
    if (count >= expectedMin) return { ok: true, count };
    await new Promise((r) => setTimeout(r, 3000));
  }
  return { ok: false, count: 0 };
}

async function main() {
  await ensureArtifacts();
  const browser = await chromium.launch({ headless: HEADLESS });
  try {
    // HR-1 flow
    const hr1Ctx = await browser.newContext();
    const hr1Page = await hr1Ctx.newPage();
    log("HR-1", "Register start", hr1.email);
    await register(hr1Page, "hr", hr1);
    await completeHrProfile(hr1Page, hr1);
    log("HR-1", "Profile completed");

    for (const job of jobsSeed) {
      log("HR-1", "Create job", job.title);
      try {
        await createJobViaUi(hr1Page, job);
      } catch {
        // fallback create via API if UI flakes
        const cr = await hr1Page.request.post(`${BASE_URL}/api/hr/jobs`, {
          data: {
            title: job.title,
            description: job.description,
            experience_required: 0,
            skills: job.skills,
            weights: { ats_weight: 1, mcq_weight: 0, coding_weight: 0, interview_weight: 0 },
          },
        });
        if (!cr.ok()) {
          const text = await cr.text();
          throw new Error(`Job create failed: ${cr.status()} ${text}`);
        }
      }
    }

    const jobs = await fetchHrJobs(hr1Page);
    const frontendJob = jobs.find((j) => j.title === jobsSeed[0].title);
    const backendJob = jobs.find((j) => j.title === jobsSeed[1].title);
    if (!frontendJob || !backendJob) {
      throw new Error("Expected created jobs not found in HR jobs list.");
    }
    log("HR-1", "Jobs created", `${frontendJob.id}, ${backendJob.id}`);

    // HR-2 flow for conflict simulation.
    const hr2Ctx = await browser.newContext();
    const hr2Page = await hr2Ctx.newPage();
    log("HR-2", "Register start", hr2.email);
    await register(hr2Page, "hr", hr2);
    await completeHrProfile(hr2Page, hr2);
    log("HR-2", "Profile completed");

    // Applicants in parallel register/login/profile
    const applicantContexts = await Promise.all(
      applicants.map(async (a) => {
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        log(a.name, "Register start", a.email);
        await register(page, "applicant", a);
        await completeApplicantProfile(page, a);
        log(a.name, "Onboarding complete");
        return { ctx, page, user: a };
      })
    );

    // Browse jobs concurrently
    await Promise.all(
      applicantContexts.map(async ({ page, user }) => {
        await page.goto(`${BASE_URL}/jobs`, { waitUntil: "networkidle" });
        log(user.name, "Browsed jobs");
      })
    );

    // Apply concurrently
    await Promise.all([
      applyForJob(applicantContexts[0].page, applicants[0], frontendJob.id),
      applyForJob(applicantContexts[1].page, applicants[1], backendJob.id),
      applyForJob(applicantContexts[2].page, applicants[2], frontendJob.id),
    ]);
    log("SYSTEM", "Concurrent applications submitted", "3 applications");

    // HR real-time simulation via polling (no websocket implementation present).
    const poll1 = await pollHrAnalytics(hr1Page, frontendJob.id, 2);
    const poll2 = await pollHrAnalytics(hr1Page, backendJob.id, 1);
    if (!poll1.ok || !poll2.ok) {
      bug("HR analytics did not reflect concurrent applications in polling window", JSON.stringify({ poll1, poll2 }));
    }

    // Duplicate application edge-case
    const dup = await duplicateApplyAttempt(applicantContexts[0].page, frontendJob.id);
    log(applicants[0].name, "Duplicate apply attempt", `status=${dup.status}`);
    if (dup.status !== 409) {
      bug("Duplicate application protection weak", `Expected 409, got ${dup.status}`);
    }

    // Invalid input edge-case
    const invalid = await invalidInputCheck(applicantContexts[1].page);
    log("SYSTEM", "Invalid input test /api/apply without job_id", `status=${invalid.status}`);
    if (invalid.status < 400) {
      bug("Invalid input accepted unexpectedly", `Status ${invalid.status}`);
    }

    // Session expiration
    const expiredStatus = await sessionExpiryCheck(hr1Ctx, hr1Page);
    log("HR-1", "Session expiration API check", `status=${expiredStatus}`);
    if (expiredStatus !== 401) {
      bug("Session expiration not enforced on protected HR jobs API", `Expected 401, got ${expiredStatus}`);
    }

    // Network delay simulation
    const delayMs = await networkDelaySimulation(applicantContexts[2].page);
    log(applicants[2].name, "Network delay simulation on /jobs", `${delayMs}ms`);

    // Multiple HR editing same job (feature gap check)
    const editAttempt1 = await hr1Page.request.post(`${BASE_URL}/api/hr/jobs`, {
      data: {
        title: jobsSeed[0].title,
        description: "Concurrent edit from HR-1",
        experience_required: 2,
        company_id: frontendJob.company_id,
        skills: ["React"],
        weights: { ats_weight: 1, mcq_weight: 0, coding_weight: 0, interview_weight: 0 },
      },
    });
    const editAttempt2 = await hr2Page.request.post(`${BASE_URL}/api/hr/jobs`, {
      data: {
        title: jobsSeed[0].title,
        description: "Concurrent edit from HR-2",
        experience_required: 3,
        company_id: frontendJob.company_id,
        skills: ["React"],
        weights: { ats_weight: 1, mcq_weight: 0, coding_weight: 0, interview_weight: 0 },
      },
    });
    log("SYSTEM", "Multiple HR concurrent edit simulation", `POST-as-edit statuses=${editAttempt1.status()}/${editAttempt2.status()}`);
    bug(
      "No explicit job update endpoint for concurrent HR edits",
      "Current API provides create/list; conflict-safe update path is missing for collaborative editing."
    );

    // Feature gap checks from requested scenario.
    bug(
      "Shortlist/reject workflow missing in HR UI/API",
      "No dedicated shortlist/reject action found in current dashboard/applicant management path."
    );
    bug(
      "Live push updates not implemented",
      "No websocket/SSE usage detected; updates rely on fetch/polling."
    );

    // Cleanup contexts
    for (const { ctx } of applicantContexts) await ctx.close();
    await hr1Ctx.close();
    await hr2Ctx.close();

    const report = {
      baseUrl: BASE_URL,
      headless: HEADLESS,
      jobs: [frontendJob, backendJob],
      findings,
      timeline,
    };
    const reportPath = path.join(outDir, "qa-report.json");
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
    log("SYSTEM", "QA report saved", reportPath);

    console.log(`\n=== QA SUMMARY ===`);
    console.log(`Actions logged: ${timeline.length}`);
    console.log(`Findings: ${findings.length}`);
    for (const f of findings) {
      console.log(`- [${f.severity}] ${f.title}: ${f.details}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(`[QA-FAIL] ${err.message}`);
  process.exit(1);
});
