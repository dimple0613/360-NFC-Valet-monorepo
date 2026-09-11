import { afterAll, describe, expect, it } from "vitest";
import { redis } from "../redis-client";
import { checkRateLimit, enforceRateLimit, RateLimitExceededError } from "../rate-limit";

const runId = Date.now().toString(36);

describe("rate limiting (NFR-2)", () => {
  afterAll(async () => {
    const keys = await redis.keys(`ratelimit:test-rl-${runId}*`);
    if (keys.length > 0) await redis.del(...keys);
    redis.disconnect();
  });

  it("allows requests up to the limit, then blocks", async () => {
    const key = `test-rl-${runId}-basic`;
    const options = { limit: 3, windowSeconds: 60 };

    for (let i = 1; i <= 3; i++) {
      const result = await checkRateLimit(key, options);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(3 - i);
    }

    const blocked = await checkRateLimit(key, options);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("different keys are independent counters", async () => {
    const options = { limit: 1, windowSeconds: 60 };
    const a = await checkRateLimit(`test-rl-${runId}-a`, options);
    const b = await checkRateLimit(`test-rl-${runId}-b`, options);
    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
  });

  it("enforceRateLimit throws RateLimitExceededError once the limit is exceeded", async () => {
    const key = `test-rl-${runId}-enforce`;
    const options = { limit: 1, windowSeconds: 60 };

    await enforceRateLimit(key, options);
    await expect(enforceRateLimit(key, options)).rejects.toThrow(RateLimitExceededError);
  });
});
