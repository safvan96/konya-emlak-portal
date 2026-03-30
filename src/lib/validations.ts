import { z } from "zod";

export const createCustomerSchema = z.object({
  name: z.string().min(2, "Ad en az 2 karakter olmalı").max(50),
  surname: z.string().min(2, "Soyad en az 2 karakter olmalı").max(50),
  email: z.string().email("Geçerli bir email adresi girin"),
  password: z.string().min(6, "Şifre en az 6 karakter olmalı"),
});

export const updateCustomerSchema = z.object({
  id: z.string(),
  name: z.string().min(2).max(50).optional(),
  surname: z.string().min(2).max(50).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  isActive: z.boolean().optional(),
});

export const assignListingsSchema = z.object({
  userId: z.string().min(1, "Müşteri seçilmeli"),
  listingIds: z.array(z.string()).min(1, "En az bir ilan seçilmeli"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Mevcut şifre gerekli"),
  newPassword: z.string().min(6, "Yeni şifre en az 6 karakter olmalı"),
});

export const createCitySchema = z.object({
  name: z.string().min(2, "Şehir adı en az 2 karakter olmalı").max(50),
  sahibindenCityId: z.string().min(1, "Sahibinden şehir ID gerekli"),
});

export const scraperTriggerSchema = z.object({
  citySlug: z.string().min(1, "Şehir seçilmeli"),
  listingType: z.enum(["SALE", "RENT"]).default("SALE"),
  maxPages: z.number().min(1).max(20).default(3),
});

export const blacklistKeywordSchema = z.object({
  keyword: z.string().min(2, "Kelime en az 2 karakter olmalı").max(100),
});

export function validateBody<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  const message = result.error.issues.map((e) => e.message).join(", ");
  return { success: false, error: message };
}
