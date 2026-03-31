/**
 * Sahibinden.com Bot - Login ile ilan çekme
 *
 * Sahibinden hesabı gerektirir.
 * .env'e ekle:
 *   SAHIBINDEN_EMAIL=xxx
 *   SAHIBINDEN_PASSWORD=xxx
 */

import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser, Page } from "puppeteer";
import { prisma } from "../prisma";
import type { ScrapeResult } from "./sahibinden";

puppeteer.use(StealthPlugin());

function normalize(text: string): string {
  const map: Record<string, string> = {
    "ç":"c","ğ":"g","ı":"i","ö":"o","ş":"s","ü":"u",
    "Ç":"c","Ğ":"g","İ":"i","Ö":"o","Ş":"s","Ü":"u",
  };
  return text.replace(/[^\x00-\x7F]/g, c => map[c] || "").toLowerCase();
}

const AGENT_WORDS = ["emlak","gayrimenkul","remax","century","coldwell","turyap","realty","danışman","broker","ofisimiz","portföy","franchise"];

function isAgent(title: string, desc: string, seller: string | null): boolean {
  const text = normalize([title, desc, seller].filter(Boolean).join(" "));
  return AGENT_WORDS.some(w => text.includes(normalize(w)));
}

function delay(min = 3000, max = 6000): Promise<void> {
  return new Promise(r => setTimeout(r, min + Math.random() * (max - min)));
}

async function login(page: Page): Promise<boolean> {
  const email = process.env.SAHIBINDEN_EMAIL;
  const password = process.env.SAHIBINDEN_PASSWORD;
  if (!email || !password) {
    console.error("SAHIBINDEN_EMAIL ve SAHIBINDEN_PASSWORD .env'de tanımlı değil!");
    return false;
  }

  console.log("Login yapılıyor...");
  await page.goto("https://secure.sahibinden.com/giris", { waitUntil: "networkidle2", timeout: 30000 });

  // Cloudflare bekle
  for (let i = 0; i < 6; i++) {
    await delay(3000, 5000);
    const title = await page.title();
    if (title.includes("Giriş") || title.includes("giris")) break;
    if (i === 5) { console.error("Login sayfası yüklenemedi"); return false; }
  }

  // Email gir
  await page.waitForSelector('input[type="email"], input[name="username"]', { timeout: 10000 });
  await page.type('input[type="email"], input[name="username"]', email, { delay: 80 + Math.random() * 40 });
  await delay(1000, 2000);

  // Şifre gir
  await page.type('input[type="password"], input[name="password"]', password, { delay: 80 + Math.random() * 40 });
  await delay(1000, 2000);

  // Giriş yap
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {});

  const url = page.url();
  console.log("Login sonrası URL:", url);

  if (url.includes("giris") || url.includes("login")) {
    console.error("Login başarısız - CAPTCHA veya yanlış bilgi olabilir");
    return false;
  }

  console.log("Login başarılı!");
  return true;
}

export async function scrapeSahibinden(
  citySlug: string,
  listingType: "SALE" | "RENT" = "SALE",
  maxPages: number = 3
): Promise<ScrapeResult> {
  const startTime = Date.now();
  const result: ScrapeResult = {
    totalFound: 0, accepted: 0, rejected: 0,
    duplicates: 0, errors: 0, duration: 0,
  };

  const city = await prisma.city.findUnique({ where: { slug: citySlug } });
  if (!city) throw new Error(`Şehir bulunamadı: ${citySlug}`);

  const scraperRun = await prisma.scraperRun.create({
    data: { cityId: city.id, status: "running" },
  });

  let browser: Browser | null = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"],
    });

    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
    await page.setViewport({ width: 1366, height: 768 });
    await page.setExtraHTTPHeaders({ "Accept-Language": "tr-TR,tr;q=0.9" });

    // Login
    const loggedIn = await login(page);
    if (!loggedIn) throw new Error("Sahibinden login başarısız");

    await delay(2000, 4000);

    const typeSlug = listingType === "SALE" ? "satilik" : "kiralik";
    const baseUrl = `https://www.sahibinden.com/${typeSlug}/${citySlug}/sahibinden`;

    for (let pageNum = 0; pageNum < maxPages; pageNum++) {
      const url = pageNum === 0 ? baseUrl : `${baseUrl}?pagingOffset=${pageNum * 20}`;
      console.log(`\nSayfa: ${url}`);

      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

      // Cloudflare/login kontrol
      const title = await page.title();
      if (title.includes("dakika") || title.includes("moment")) {
        await delay(10000, 15000);
      }
      if (page.url().includes("giris") || page.url().includes("login")) {
        console.error("Session expired - login gerekli");
        break;
      }

      // İlan linklerini topla
      const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll(".searchResultsItem a.classifiedTitle"))
          .map(a => ({
            href: (a as HTMLAnchorElement).href,
            id: (a as HTMLAnchorElement).href.match(/\/(\d+)\//)?.[1] || "",
            text: a.textContent?.trim() || "",
          }))
          .filter(l => l.id);
      });

      result.totalFound += links.length;
      console.log(`  ${links.length} ilan bulundu`);

      if (links.length === 0) break;

      // Her ilanın detayına gir
      for (const link of links) {
        try {
          const existing = await prisma.listing.findUnique({ where: { sahibindenId: link.id } });
          if (existing) { result.duplicates++; continue; }

          await delay();
          await page.goto(link.href, { waitUntil: "networkidle2", timeout: 30000 });

          const data = await page.evaluate(() => {
            const title = document.querySelector(".classifiedDetailTitle h1")?.textContent?.trim() || "";
            const desc = document.querySelector("#classifiedDescription")?.textContent?.trim() || "";
            const priceText = document.querySelector(".classifiedInfo h3")?.textContent?.trim() || "";
            const price = parseInt(priceText.replace(/[^0-9]/g, "")) || null;

            const locLinks = document.querySelectorAll(".classifiedInfo h2 a");
            const location = Array.from(locLinks).map(a => a.textContent?.trim()).filter(Boolean);

            const info: Record<string, string> = {};
            document.querySelectorAll(".classifiedInfoList li").forEach(li => {
              const label = li.querySelector("strong")?.textContent?.trim() || "";
              const value = li.querySelector("span")?.textContent?.trim() || "";
              if (label && value) info[label] = value;
            });

            const images = Array.from(document.querySelectorAll(".classifiedDetailPhotos img, .classifiedPhoto img"))
              .map(img => (img as HTMLImageElement).src || (img as HTMLImageElement).dataset.src || "")
              .filter(src => src && !src.includes("placeholder"));

            const seller = document.querySelector(".username-info-area h5")?.textContent?.trim() || null;
            const phone = document.querySelector(".phone-number, .classifiedDetail .phone")?.textContent?.trim() || null;

            return {
              title, desc, price, location: location.join(", "),
              district: location[1] || null,
              neighborhood: location[2] || null,
              roomCount: info["Oda Sayısı"] || null,
              squareMeters: info["m² (Brüt)"] ? parseInt(info["m² (Brüt)"].replace(/[^0-9]/g, "")) : null,
              buildingAge: info["Bina Yaşı"] || null,
              floor: info["Bulunduğu Kat"] || null,
              images, seller, phone,
            };
          });

          if (!data.title) { result.errors++; continue; }

          // Emlakçı filtresi
          if (isAgent(data.title, data.desc, data.seller)) {
            result.rejected++;
            continue;
          }

          const catSlug = data.title.toLowerCase().includes("arsa") ? "arsa" :
            data.title.toLowerCase().includes("villa") ? "villa" :
            data.title.toLowerCase().includes("müstakil") ? "mustakil-ev" : "daire";
          const cat = await prisma.category.findUnique({ where: { slug: catSlug } });

          await prisma.listing.create({
            data: {
              sahibindenId: link.id,
              title: data.title,
              description: data.desc,
              price: data.price,
              currency: "TL",
              listingType,
              location: data.location || `Konya`,
              district: data.district,
              neighborhood: data.neighborhood,
              roomCount: data.roomCount,
              squareMeters: data.squareMeters,
              buildingAge: data.buildingAge,
              floor: data.floor,
              imageUrls: data.images.slice(0, 20),
              sourceUrl: link.href,
              sellerName: data.seller || "Sahibinden",
              sellerPhone: data.phone,
              isFromOwner: true,
              status: "ACTIVE",
              cityId: city.id,
              categoryId: cat?.id || null,
            },
          });

          result.accepted++;
          console.log(`  ✓ ${data.title.substring(0, 50)} | ${data.price?.toLocaleString("tr-TR")} TL`);
        } catch (err) {
          result.errors++;
        }
      }

      await delay(3000, 5000);
    }

    result.duration = Date.now() - startTime;
    await prisma.scraperRun.update({
      where: { id: scraperRun.id },
      data: { ...result, status: "completed", completedAt: new Date() },
    });

    return result;
  } catch (err) {
    await prisma.scraperRun.update({
      where: { id: scraperRun.id },
      data: { status: "failed", errorMessage: err instanceof Error ? err.message : "Hata", completedAt: new Date(), duration: Date.now() - startTime },
    });
    throw err;
  } finally {
    if (browser) await browser.close();
  }
}
