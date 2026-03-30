import { describe, it, expect } from "vitest";
import { formatPrice, slugify, proxyImageUrl } from "@/lib/utils";

describe("formatPrice", () => {
  it("formats Turkish Lira correctly", () => {
    const result = formatPrice(1500000);
    expect(result).toContain("1.500.000");
  });

  it("returns placeholder for null", () => {
    expect(formatPrice(null)).toBe("Fiyat belirtilmemiş");
  });

  it("returns placeholder for undefined", () => {
    expect(formatPrice(undefined)).toBe("Fiyat belirtilmemiş");
  });

  it("returns placeholder for 0", () => {
    expect(formatPrice(0)).toBe("Fiyat belirtilmemiş");
  });
});

describe("slugify", () => {
  it("converts Turkish characters", () => {
    expect(slugify("Konya Şehri")).toBe("konya-sehri");
  });

  it("handles special characters", () => {
    expect(slugify("Test & Deneme!")).toBe("test-deneme");
  });

  it("handles multiple spaces", () => {
    expect(slugify("Çok   Boşluklu   Metin")).toBe("cok-bosluklu-metin");
  });

  it("converts İ to i", () => {
    expect(slugify("İstanbul")).toBe("istanbul");
  });

  it("converts ö to o", () => {
    expect(slugify("Gölbaşı")).toBe("golbasi");
  });
});

describe("proxyImageUrl", () => {
  it("proxies sahibinden URLs", () => {
    const result = proxyImageUrl("https://img.sahibinden.com/photo.jpg");
    expect(result).toContain("/api/images?url=");
    expect(result).toContain("sahibinden");
  });

  it("returns non-sahibinden URLs as-is", () => {
    expect(proxyImageUrl("https://example.com/img.jpg")).toBe("https://example.com/img.jpg");
  });

  it("returns empty string as-is", () => {
    expect(proxyImageUrl("")).toBe("");
  });
});
