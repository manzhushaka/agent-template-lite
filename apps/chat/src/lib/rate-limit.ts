interface Bucket { count: number; resetAt: number }
const buckets = new Map<string, Bucket>();

/** Single-host limiter for expensive Agent runs; distributed deployments should use Redis. */
export function consumeRunLimit(key: string, now = Date.now(), limit = 20, windowMs = 60_000) {
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }
  if (current.count >= limit) return { allowed: false, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  current.count += 1;
  if (buckets.size > 10_000) {
    for (const [bucketKey, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(bucketKey);
  }
  return { allowed: true, retryAfter: 0 };
}
