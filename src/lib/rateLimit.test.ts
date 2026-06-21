import { describe, it, expect } from "vitest";
import { createRateLimiter } from "./rateLimit";

describe("createRateLimiter", () => {
  it("allows hits up to the limit, then blocks", () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 3 });
    expect(limiter.check("a", 0)).toBe(true);
    expect(limiter.check("a", 1)).toBe(true);
    expect(limiter.check("a", 2)).toBe(true);
    expect(limiter.check("a", 3)).toBe(false); // 4th within window
  });

  it("tracks keys independently", () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 1 });
    expect(limiter.check("a", 0)).toBe(true);
    expect(limiter.check("b", 0)).toBe(true);
    expect(limiter.check("a", 0)).toBe(false);
  });

  it("frees capacity once the window elapses", () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 1 });
    expect(limiter.check("a", 0)).toBe(true);
    expect(limiter.check("a", 500)).toBe(false); // still inside window
    expect(limiter.check("a", 1000)).toBe(true); // window passed (1000 - 0 not < 1000)
  });
});
