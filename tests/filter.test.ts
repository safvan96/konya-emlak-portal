import { describe, it, expect } from "vitest";

// filterListing DB'ye bagimli oldugundan, saf filtreleme mantigi test edilir
// Burada blacklist keyword eslesme mantigi test ediyoruz

function matchesBlacklist(text: string, keywords: string[]): string[] {
  const lower = text.toLowerCase();
  return keywords.filter((kw) => lower.includes(kw.toLowerCase()));
}

function checkSellerName(name: string): boolean {
  const patterns = [/emlak/i, /gayrimenkul/i, /remax/i, /century/i, /danışman/i, /consultant/i];
  return patterns.some((p) => p.test(name));
}

function countPhoneNumbers(text: string): number {
  const pattern = /0?\d{3}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/g;
  return (text.match(pattern) || []).length;
}

function hasExternalUrl(text: string): boolean {
  const pattern = /(?:www\.|https?:\/\/)[\w.-]+\.(?:com|net|org|com\.tr)/gi;
  const urls = text.match(pattern) || [];
  return urls.some((u) => !u.includes("sahibinden"));
}

describe("Blacklist matching", () => {
  const keywords = ["emlak danışmanı", "remax", "century 21", "portföy no"];

  it("detects agent keywords in description", () => {
    const matches = matchesBlacklist("Bu ilan emlak danışmanı tarafından yayınlanmıştır", keywords);
    expect(matches).toContain("emlak danışmanı");
  });

  it("returns empty for owner listings", () => {
    const matches = matchesBlacklist("Sahibinden satılık 3+1 daire, müstakil giriş", keywords);
    expect(matches).toHaveLength(0);
  });

  it("detects multiple keywords", () => {
    const matches = matchesBlacklist("Remax danışmanı portföy no: 12345", keywords);
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("case insensitive matching", () => {
    const matches = matchesBlacklist("REMAX EMLAK OFİSİ", keywords);
    expect(matches).toContain("remax");
  });
});

describe("Seller name detection", () => {
  it("detects emlak in seller name", () => {
    expect(checkSellerName("Güneş Emlak")).toBe(true);
  });

  it("detects remax", () => {
    expect(checkSellerName("Remax Partner")).toBe(true);
  });

  it("allows regular owner names", () => {
    expect(checkSellerName("Ahmet Yılmaz")).toBe(false);
  });

  it("detects danışman", () => {
    expect(checkSellerName("Mehmet - Gayrimenkul Danışmanı")).toBe(true);
  });
});

describe("Phone number detection", () => {
  it("detects multiple phone numbers", () => {
    const text = "İletişim: 0532 123 45 67, 0542 987 65 43, 0555 111 22 33";
    expect(countPhoneNumbers(text)).toBe(3);
  });

  it("returns 0 for no numbers", () => {
    expect(countPhoneNumbers("Satılık daire, 3+1, 120m2")).toBe(0);
  });

  it("detects numbers with different separators", () => {
    const text = "0532-123-45-67 ve 0542.987.65.43";
    expect(countPhoneNumbers(text)).toBe(2);
  });
});

describe("External URL detection", () => {
  it("detects external websites", () => {
    expect(hasExternalUrl("Detaylar: www.gunesemlak.com")).toBe(true);
  });

  it("ignores sahibinden URLs", () => {
    expect(hasExternalUrl("https://www.sahibinden.com/ilan/123")).toBe(false);
  });

  it("detects .com.tr domains", () => {
    expect(hasExternalUrl("Bilgi: www.emlakjet.com.tr")).toBe(true);
  });

  it("returns false for no URLs", () => {
    expect(hasExternalUrl("Satılık daire, temiz, bakımlı")).toBe(false);
  });
});
