/**
 * Profesyonel Sahibinden Bot
 *
 * - İnsan davranışı simülasyonu (random scroll, mouse move, click delay)
 * - Akıllı rate limiting (saatte max 20 istek)
 * - Session yönetimi (cookie persistence)
 * - Queue sistemi (ilanları DB'ye kaydedip sırayla çek)
 * - Otomatik retry + backoff
 * - Chrome debug port ile çalışır (RDP'den login gerekli)
 */

import puppeteer, { type Page } from "puppeteer";
import { prisma } from "../prisma";
import * as fs from "fs";

const COOKIE_FILE = (process.env.USERPROFILE || "/tmp") + "/sb_session.json";
const MAX_REQUESTS_PER_HOUR = 15; // Saatte max istek
const MIN_DELAY = 120000; // 2 dakika minimum
const MAX_DELAY = 240000; // 4 dakika maximum
const BLOCK_WAIT = 600000; // Engelde 10 dakika bekle

function normalize(t: string) {
  const m: Record<string, string> = {"ç":"c","ğ":"g","ı":"i","ö":"o","ş":"s","ü":"u","Ç":"c","Ğ":"g","İ":"i","Ö":"o","Ş":"s","Ü":"u"};
  return t.replace(/[^\x00-\x7F]/g, c => m[c] || "").toLowerCase();
}

const AGENT_WORDS = ["emlak","gayrimenkul","remax","century","coldwell","turyap","danışman","broker","ofisimiz","portföy"];
function isAgent(t: string) { return AGENT_WORDS.some(w => normalize(t).includes(normalize(w))); }

function humanDelay() {
  const ms = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);
  return new Promise(r => setTimeout(r, ms));
}

// İnsan benzeri davranış
async function humanBehavior(page: Page) {
  // Random scroll
  const scrollAmount = 200 + Math.random() * 800;
  await page.evaluate((s) => window.scrollBy(0, s), scrollAmount);
  await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));

  // Bazen yukarı scroll
  if (Math.random() > 0.7) {
    await page.evaluate(() => window.scrollBy(0, -300));
    await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
  }

  // Random mouse move
  const x = 100 + Math.random() * 800;
  const y = 100 + Math.random() * 500;
  await page.mouse.move(x, y);
  await new Promise(r => setTimeout(r, 300 + Math.random() * 700));
}

// Engel kontrolü
async function isBlocked(page: Page): Promise<boolean> {
  const title = await page.title();
  const url = page.url();
  return title.includes("Olağan") || title.includes("Hata") ||
         url.includes("olagan") || url.includes("checkLoading");
}

// Login kontrolü
async function isLoginRequired(page: Page): Promise<boolean> {
  const url = page.url();
  return url.includes("giris") || url.includes("login");
}

// Çekilmemiş ilan ID'lerini queue'ye ekle
async function queueListings(page: Page, listUrl: string): Promise<string[]> {
  await page.goto(listUrl, { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise(r => setTimeout(r, 5000 + Math.random() * 3000));
  await humanBehavior(page);

  if (await isBlocked(page)) return [];
  if (await isLoginRequired(page)) return [];

  const items = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("tr[data-id]")).map(tr => ({
      id: tr.getAttribute("data-id") || "",
      href: (tr.querySelector('a[href*="/ilan/"]') as HTMLAnchorElement)?.href || "",
    })).filter(x => x.id && x.href);
  });

  // DB'de olmayanları filtrele
  const newItems: string[] = [];
  for (const item of items) {
    const exists = await prisma.listing.findUnique({ where: { sahibindenId: item.id } });
    if (!exists) newItems.push(item.href + "|" + item.id);
  }

  return newItems;
}

// Tek bir ilan detayını çek
async function scrapeDetail(page: Page, href: string, id: string, cityId: string): Promise<boolean> {
  await page.goto(href, { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000 + Math.random() * 4000));
  await humanBehavior(page);

  if (await isBlocked(page)) return false;

  const data = await page.evaluate(() => {
    const t = document.querySelector("h1")?.textContent?.trim() || "";
    const d = document.querySelector("#classifiedDescription")?.textContent?.trim() || "";
    const pr = document.querySelector(".classifiedInfo h3")?.textContent?.trim() || "";
    const loc = Array.from(document.querySelectorAll(".classifiedInfo h2 a"))
      .map(a => a.textContent?.trim()).filter(Boolean) as string[];
    const imgs = Array.from(document.querySelectorAll("img[data-src]"))
      .map(i => (i as HTMLImageElement).dataset.src || "")
      .filter(s => s && !s.includes("placeholder")).slice(0, 20);
    const seller = document.querySelector(".username-info-area h5")?.textContent?.trim() || null;
    const info: Record<string, string> = {};
    document.querySelectorAll(".classifiedInfoList li").forEach(li => {
      const l = li.querySelector("strong")?.textContent?.trim();
      const v = li.querySelector("span")?.textContent?.trim();
      if (l && v) info[l] = v;
    });
    return { t, d, price: parseInt(pr.replace(/[^0-9]/g, "")) || null, loc, imgs, seller, info };
  });

  if (!data.t) return false;
  if (isAgent(data.t + " " + data.d + " " + (data.seller || ""))) return false;

  const isRent = href.includes("kiralik");
  const cs = normalize(data.t);
  const catSlug = cs.includes("arsa") ? "arsa" : cs.includes("villa") ? "villa" : cs.includes("mustakil") ? "mustakil-ev" : "daire";
  const cat = await prisma.category.findUnique({ where: { slug: catSlug } });

  await prisma.listing.create({
    data: {
      sahibindenId: id, title: data.t, description: data.d.substring(0, 5000),
      price: data.price, currency: "TL", listingType: isRent ? "RENT" : "SALE",
      location: data.loc.join(", ") || "Konya", district: data.loc[1] || null, neighborhood: data.loc[2] || null,
      roomCount: data.info["Oda Sayısı"] || null,
      squareMeters: data.info["m² (Brüt)"] ? parseInt(data.info["m² (Brüt)"].replace(/[^0-9]/g, "")) : null,
      buildingAge: data.info["Bina Yaşı"] || null,
      floor: data.info["Bulunduğu Kat"] || null,
      imageUrls: data.imgs, sourceUrl: href,
      sellerName: data.seller || "Sahibinden", sellerPhone: null,
      isFromOwner: true, status: "ACTIVE", cityId, categoryId: cat?.id || null,
    },
  });

  return true;
}

export async function runProfessionalBot() {
  console.log("=== Profesyonel Sahibinden Bot ===\n");
  console.log(`Ayarlar: max ${MAX_REQUESTS_PER_HOUR}/saat, ${MIN_DELAY/1000}-${MAX_DELAY/1000}sn delay\n`);

  let browser;
  try {
    browser = await puppeteer.connect({ browserURL: "http://localhost:9222" });
  } catch {
    console.error("Chrome bağlantısı yok! RDP'den Chrome'u aç ve sahibinden'e login ol.");
    return;
  }

  const [page] = await browser.pages();
  const city = await prisma.city.findUnique({ where: { slug: "konya" } });
  if (!city) { console.error("Konya yok"); return; }

  // Login kontrolü
  await page.goto("https://www.sahibinden.com", { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise(r => setTimeout(r, 5000));

  if (await isLoginRequired(page)) {
    console.error("LOGIN GEREKLİ! RDP'den sahibinden'e login ol.");
    browser.disconnect();
    return;
  }

  if (await isBlocked(page)) {
    console.error("IP ENGELLİ! Birkaç saat bekle.");
    browser.disconnect();
    return;
  }

  console.log("Sahibinden erişim OK!\n");

  let requestCount = 0;
  let accepted = 0;

  const categories = [
    "satilik-daire/konya/sahibinden",
    "satilik-mustakil-ev/konya/sahibinden",
    "satilik-arsa/konya/sahibinden",
    "satilik-villa/konya/sahibinden",
    "kiralik-daire/konya/sahibinden",
  ];

  for (const cat of categories) {
    if (requestCount >= MAX_REQUESTS_PER_HOUR) {
      console.log("\nSaatlik limit doldu. Durduruluyor.");
      break;
    }

    const listUrl = `https://www.sahibinden.com/${cat}`;
    console.log(`\n📂 ${cat}`);

    await humanDelay();
    requestCount++;

    const queue = await queueListings(page, listUrl);
    console.log(`  ${queue.length} yeni ilan sırada`);

    if (queue.length === 0) continue;

    for (const item of queue) {
      if (requestCount >= MAX_REQUESTS_PER_HOUR) break;

      const [href, id] = item.split("|");

      console.log(`  ⏳ Bekleniyor...`);
      await humanDelay();
      requestCount++;

      if (await isBlocked(page)) {
        console.log(`  🚫 Engel! ${BLOCK_WAIT/60000}dk bekleniyor...`);
        await new Promise(r => setTimeout(r, BLOCK_WAIT));
        continue;
      }

      const ok = await scrapeDetail(page, href, id, city.id);
      if (ok) {
        accepted++;
        const listing = await prisma.listing.findUnique({ where: { sahibindenId: id }, select: { title: true, price: true } });
        console.log(`  ✅ ${listing?.title?.substring(0, 45)} | ${listing?.price?.toLocaleString("tr-TR")} TL`);
      }
    }
  }

  console.log(`\n=== SONUÇ: ${accepted} yeni ilan | ${requestCount} istek yapıldı ===`);
  console.log("DB:", await prisma.listing.count());

  browser.disconnect();
}
