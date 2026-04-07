type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string, maxRequests: number, windowMs: number) {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    const next: Bucket = { count: 1, resetAt: now + windowMs };
    buckets.set(key, next);
    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - 1),
      retryAfterMs: windowMs,
    };
  }

  if (existing.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, existing.resetAt - now),
    };
  }

  existing.count += 1;
  buckets.set(key, existing);
  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - existing.count),
    retryAfterMs: Math.max(0, existing.resetAt - now),
  };
}
