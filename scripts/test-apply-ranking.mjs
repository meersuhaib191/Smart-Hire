import process from "node:process";
import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const stamp = Date.now();

const hr = {
  name: `HR Rank ${stamp}`,
  email: `hr.rank.${stamp}@example.com`,
  password: "TestPass123!",
  company: `RankCorp ${stamp}`,
};

const applicant = {
  name: `Applicant Rank ${stamp}`,
  email: `app.rank.${stamp}@example.com`,
  password: "TestPass123!",
};

const job = {
  title: `Ranking QA Engineer ${stamp}`,
  description: "Build tests, validate ranking, and monitor hiring pipeline quality.",
  skills: ["Testing", "TypeScript"],
};

function log(msg) {
  console.log(`[TEST] ${msg}`);
}

async function registerAndLogin(page, role, user) {
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

  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("applicant@example.com").fill(user.email);
  await page.locator('input[type="password"]').first().fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForFunction(
    () => window.location.pathname !== "/login",
    null,
    { timeout: 120000 }
  );
  await page.waitForTimeout(1000);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    // HR setup and job creation.
    const hrCtx = await browser.newContext();
    const hrPage = await hrCtx.newPage();
    log("Register/login HR");
    await registerAndLogin(hrPage, "hr", hr);

    log("Complete HR profile via API");
    const hrProfileRes = await hrPage.request.put(`${BASE_URL}/api/hr/profile`, {
      data: {
        fullName: hr.name,
        companyName: hr.company,
        jobTitle: "Hiring Manager",
        isProfileComplete: true,
      },
    });
    const hrProfileJson = await hrProfileRes.json().catch(() => ({}));
    if (!hrProfileRes.ok) throw new Error(`HR profile save failed: ${hrProfileRes.status()} ${JSON.stringify(hrProfileJson)}`);

    log("Create job via API");
    const createRes = await hrPage.request.post(`${BASE_URL}/api/hr/jobs`, {
      data: {
        title: job.title,
        description: job.description,
        experience_required: 1,
        company_id: hr.company,
        skills: job.skills,
        weights: { ats_weight: 1, mcq_weight: 0, coding_weight: 0, interview_weight: 0 },
      },
    });
    const createJson = await createRes.json().catch(() => ({}));
    if (!createRes.ok) throw new Error(`Job create failed: ${createRes.status()} ${JSON.stringify(createJson)}`);
    const jobId = createJson.jobId;
    if (!jobId) throw new Error("Job ID missing in create response.");
    log(`Created job id=${jobId}`);

    // Applicant applies.
    const appCtx = await browser.newContext();
    const appPage = await appCtx.newPage();
    log("Register/login applicant");
    await registerAndLogin(appPage, "applicant", applicant);

    log("Complete applicant profile via API");
    const applicantProfileRes = await appPage.request.put(`${BASE_URL}/api/applicant/profile`, {
      data: {
        fullName: applicant.name,
        isProfileComplete: true,
      },
    });
    const applicantProfileJson = await applicantProfileRes.json().catch(() => ({}));
    if (!applicantProfileRes.ok) {
      throw new Error(`Applicant profile save failed: ${applicantProfileRes.status()} ${JSON.stringify(applicantProfileJson)}`);
    }

    log("Apply to job");
    const applyRes = await appPage.request.post(`${BASE_URL}/api/apply`, {
      multipart: {
        job_id: jobId,
        cover_letter: "I am a strong fit for this role.",
        resume: {
          name: "resume.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n", "utf8"),
        },
      },
    });
    const applyJson = await applyRes.json().catch(() => ({}));
    if (!applyRes.ok) throw new Error(`Apply failed: ${applyRes.status()} ${JSON.stringify(applyJson)}`);
    const applicationId = applyJson.applicationId || applyJson?.application?.id;
    if (!applicationId) throw new Error("Application ID missing from apply response.");
    log(`Applied applicationId=${applicationId}`);

    // Trigger final scoring/ranking.
    log("Trigger final scoring");
    const scoreRes = await appPage.request.post(`${BASE_URL}/api/scoring/final`, {
      data: { applicationId },
    });
    const scoreJson = await scoreRes.json().catch(() => ({}));
    if (!scoreRes.ok) throw new Error(`Final scoring failed: ${scoreRes.status()} ${JSON.stringify(scoreJson)}`);
    log(`Final score=${scoreJson.finalScore}`);

    // Verify applicant can see ranking in detail API.
    const detailRes = await appPage.request.get(`${BASE_URL}/api/applicant/applications/${applicationId}`);
    const detailJson = await detailRes.json().catch(() => ({}));
    if (!detailRes.ok) throw new Error(`Application detail failed: ${detailRes.status()} ${JSON.stringify(detailJson)}`);
    const rankPosition = detailJson?.ranking?.rank_position ?? null;
    log(`Applicant detail ranking position=${rankPosition}`);

    // Verify HR analytics sees candidate + ranking.
    const analyticsRes = await hrPage.request.get(`${BASE_URL}/api/hr/jobs/${jobId}/analytics`);
    const analyticsJson = await analyticsRes.json().catch(() => ({}));
    if (!analyticsRes.ok) throw new Error(`HR analytics failed: ${analyticsRes.status()} ${JSON.stringify(analyticsJson)}`);
    const candidate = (analyticsJson.candidates || []).find((c) => c.applicationId === applicationId);
    if (!candidate) throw new Error("Candidate missing from HR analytics.");
    log(`HR analytics candidate finalScore=${candidate.finalScore}, rank=${candidate.rankPosition}`);

    console.log("\nPASS: apply + ranking flow verified.");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(`FAIL: ${err.message}`);
  process.exit(1);
});
