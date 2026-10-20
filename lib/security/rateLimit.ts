/**
 * In-memory sliding-window rate limiter for server routes.
 *
 * NOTE ON SERVERLESS DEPLOYMENTS:
 * This in-memory counter is local to the active serverless function instance.
 * While effective against bursts and automated abuse targeting a warm container,
 * state is not shared across multi-region instances or cold starts.
 * For production-grade distributed enforcement, integrate a shared store such as
 * Upstash Redis (@upstash/ratelimit) or a persistent database counter table.
 */

interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup old keys periodically (every 5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupExpired(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [key, record] of rateLimitStore.entries()) {
    record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);
    if (record.timestamps.length === 0) {
      rateLimitStore.delete(key);
    }
  }
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

/**
 * Checks whether an identifier (e.g. user ID or IP) has exceeded the rate limit.
 *
 * @param identifier Unique key (e.g. authenticated user ID)
 * @param limit Max requests allowed within window (default: 15)
 * @param windowMs Time window in milliseconds (default: 60,000ms = 1 min)
 */
export function checkRateLimit(
  identifier: string,
  limit = 15,
  windowMs = 60 * 1000
): RateLimitResult {
  if (!identifier || typeof identifier !== "string") {
    return {
      success: true,
      limit,
      remaining: limit,
      resetSeconds: 0,
    };
  }

  const now = Date.now();
  cleanupExpired(windowMs);

  let record = rateLimitStore.get(identifier);
  if (!record) {
    record = { timestamps: [] };
    rateLimitStore.set(identifier, record);
  }

  // Filter timestamps within the current sliding window
  record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

  const currentCount = record.timestamps.length;
  const remaining = Math.max(0, limit - currentCount);

  // Determine oldest timestamp for retry-after calculation
  const oldestTs = record.timestamps[0] || now;
  const resetSeconds = Math.max(1, Math.ceil((oldestTs + windowMs - now) / 1000));

  if (currentCount >= limit) {
    return {
      success: false,
      limit,
      remaining: 0,
      resetSeconds,
    };
  }

  // Record this request
  record.timestamps.push(now);

  return {
    success: true,
    limit,
    remaining: remaining - 1,
    resetSeconds,
  };
}
