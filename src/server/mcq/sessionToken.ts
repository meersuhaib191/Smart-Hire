import crypto from "crypto";

const TOKEN_TTL_SECONDS = Number(process.env.MCQ_EXAM_DURATION_SECONDS || 15 * 60);
const TOKEN_GRACE_SECONDS = Number(process.env.MCQ_EXAM_GRACE_SECONDS || 30);

function getSecret() {
  const explicit = process.env.MCQ_SESSION_SECRET;
  if (explicit && explicit.length >= 16) return explicit;
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "smart-hire-dev-secret";
}

export function createMcqSessionToken(applicationId: string, issuedAt = Math.floor(Date.now() / 1000)) {
  const payload = `${applicationId}.${issuedAt}`;
  const sig = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifyMcqSessionToken(token: string, applicationId: string) {
  const [tokenAppId, issuedAtRaw, signature] = token.split(".");
  if (!tokenAppId || !issuedAtRaw || !signature) {
    return { valid: false as const, error: "Invalid session token.", reason: "invalid" as const };
  }
  if (tokenAppId !== applicationId) {
    return {
      valid: false as const,
      error: "Session token does not match application.",
      reason: "invalid" as const,
    };
  }

  const issuedAt = Number(issuedAtRaw);
  if (!Number.isInteger(issuedAt) || issuedAt <= 0) {
    return { valid: false as const, error: "Invalid session token timestamp.", reason: "invalid" as const };
  }

  const payload = `${tokenAppId}.${issuedAt}`;
  const expected = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    return { valid: false as const, error: "Invalid session token signature.", reason: "invalid" as const };
  }

  const now = Math.floor(Date.now() / 1000);
  if (issuedAt > now + 60) {
    return { valid: false as const, error: "Session token is not yet valid.", reason: "invalid" as const };
  }
  if (now > issuedAt + TOKEN_TTL_SECONDS + TOKEN_GRACE_SECONDS) {
    return { valid: false as const, error: "MCQ exam time window has expired.", reason: "expired" as const };
  }

  return { valid: true as const, issuedAt };
}

export function getMcqExamSeconds() {
  return TOKEN_TTL_SECONDS;
}

export function getMcqRemainingSeconds(issuedAt: number) {
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, issuedAt + TOKEN_TTL_SECONDS - now);
}
