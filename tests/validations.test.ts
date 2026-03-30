import { describe, it, expect } from "vitest";
import {
  createCustomerSchema,
  changePasswordSchema,
  blacklistKeywordSchema,
  scraperTriggerSchema,
  assignListingsSchema,
  validateBody,
} from "@/lib/validations";

describe("createCustomerSchema", () => {
  it("accepts valid data", () => {
    const result = validateBody(createCustomerSchema, {
      name: "Ali",
      surname: "Yilmaz",
      email: "ali@test.com",
      password: "123456",
    });
    expect(result.success).toBe(true);
  });

  it("rejects short name", () => {
    const result = validateBody(createCustomerSchema, {
      name: "A",
      surname: "Yilmaz",
      email: "ali@test.com",
      password: "123456",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = validateBody(createCustomerSchema, {
      name: "Ali",
      surname: "Yilmaz",
      email: "invalid",
      password: "123456",
    });
    expect(result.success).toBe(false);
  });

  it("rejects short password", () => {
    const result = validateBody(createCustomerSchema, {
      name: "Ali",
      surname: "Yilmaz",
      email: "ali@test.com",
      password: "12345",
    });
    expect(result.success).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  it("accepts valid passwords", () => {
    const result = validateBody(changePasswordSchema, {
      currentPassword: "oldpass",
      newPassword: "newpass123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty current password", () => {
    const result = validateBody(changePasswordSchema, {
      currentPassword: "",
      newPassword: "newpass123",
    });
    expect(result.success).toBe(false);
  });
});

describe("blacklistKeywordSchema", () => {
  it("accepts valid keyword", () => {
    const result = validateBody(blacklistKeywordSchema, { keyword: "emlak danismani" });
    expect(result.success).toBe(true);
  });

  it("rejects single char", () => {
    const result = validateBody(blacklistKeywordSchema, { keyword: "a" });
    expect(result.success).toBe(false);
  });
});

describe("scraperTriggerSchema", () => {
  it("accepts valid trigger", () => {
    const result = validateBody(scraperTriggerSchema, {
      citySlug: "konya",
      listingType: "SALE",
      maxPages: 5,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid listing type", () => {
    const result = validateBody(scraperTriggerSchema, {
      citySlug: "konya",
      listingType: "INVALID",
    });
    expect(result.success).toBe(false);
  });

  it("rejects maxPages > 20", () => {
    const result = validateBody(scraperTriggerSchema, {
      citySlug: "konya",
      maxPages: 25,
    });
    expect(result.success).toBe(false);
  });
});

describe("assignListingsSchema", () => {
  it("accepts valid assignment", () => {
    const result = validateBody(assignListingsSchema, {
      userId: "user123",
      listingIds: ["listing1", "listing2"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty listingIds", () => {
    const result = validateBody(assignListingsSchema, {
      userId: "user123",
      listingIds: [],
    });
    expect(result.success).toBe(false);
  });
});
