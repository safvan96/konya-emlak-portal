import { describe, it, expect } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

describe("rateLimit", () => {
  it("allows requests within limit", () => {
    const key = `test-${Date.now()}`;
    const result = rateLimit(key, 5, 60000);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("blocks after exceeding limit", () => {
    const key = `test-block-${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      rateLimit(key, 3, 60000);
    }
    const result = rateLimit(key, 3, 60000);
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("decrements remaining correctly", () => {
    const key = `test-remaining-${Date.now()}`;
    const r1 = rateLimit(key, 5, 60000);
    expect(r1.remaining).toBe(4);
    const r2 = rateLimit(key, 5, 60000);
    expect(r2.remaining).toBe(3);
    const r3 = rateLimit(key, 5, 60000);
    expect(r3.remaining).toBe(2);
  });

  it("tracks different keys separately", () => {
    const key1 = `test-a-${Date.now()}`;
    const key2 = `test-b-${Date.now()}`;

    for (let i = 0; i < 3; i++) rateLimit(key1, 3, 60000);

    const r1 = rateLimit(key1, 3, 60000);
    const r2 = rateLimit(key2, 3, 60000);

    expect(r1.success).toBe(false);
    expect(r2.success).toBe(true);
  });
});
