import { describe, it, expect } from "vitest";
import { slugify, formatDate, cn } from "@/lib/utils";

describe("slugify edge cases", () => {
  it("handles empty string", () => {
    expect(slugify("")).toBe("");
  });

  it("handles numbers", () => {
    expect(slugify("Daire 123")).toBe("daire-123");
  });

  it("handles consecutive special chars", () => {
    expect(slugify("test---deneme")).toBe("test-deneme");
  });

  it("trims leading/trailing dashes", () => {
    expect(slugify("-test-")).toBe("test");
  });

  it("handles all Turkish chars", () => {
    expect(slugify("çÇğĞıİöÖşŞüÜ")).toBe("ccggiioossuu");
  });

  it("handles Konya districts", () => {
    expect(slugify("Selçuklu")).toBe("selcuklu");
    expect(slugify("Karatay")).toBe("karatay");
    expect(slugify("Meram")).toBe("meram");
  });
});

describe("formatDate", () => {
  it("formats a date string", () => {
    const result = formatDate("2026-01-15T10:30:00Z");
    expect(result).toContain("15");
    expect(result).toContain("01");
    expect(result).toContain("2026");
  });

  it("formats a Date object", () => {
    const result = formatDate(new Date("2026-06-20T14:00:00Z"));
    expect(result).toContain("20");
    expect(result).toContain("06");
  });
});

describe("cn utility", () => {
  it("merges class names", () => {
    expect(cn("px-4", "py-2")).toContain("px-4");
    expect(cn("px-4", "py-2")).toContain("py-2");
  });

  it("handles conditional classes", () => {
    const isActive = true;
    expect(cn("base", isActive && "active")).toContain("active");
  });

  it("handles falsy values", () => {
    expect(cn("base", false, null, undefined, "extra")).toBe("base extra");
  });
});
