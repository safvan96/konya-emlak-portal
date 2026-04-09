/**
 * Durmayan Bot + Akıllı İlan Dağıtımı
 *
 * - Sonsuz döngüde çalışır (tüm kategorileri gezer, başa döner)
 * - Pasif dinleyici + insan gezinti birlikte
 * - Her müşteriye FARKLI ilanlar atar (görmedikleri ilanları verir)
 * - Yeni ilanlar öncelikli
 */
import puppeteer, { type Page } from "puppeteer";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalize(t: string) {
  const m: Record<string, string> = {"ç":"c","ğ":"g","ı":"i","ö":"o","ş":"s","ü":"u","Ç":"c","Ğ":"g","İ":"i","Ö":"o","Ş":"s","Ü":"u"};
  return t.replace(/[^\x00-\x7F]/g, c => m[c] || "").toLowerCase();
}

const AGENT = ["emlak","gayrimenkul","remax","century","coldwell","turyap","danışman","broker","ofisimiz","portföy"];
function isAgent(t: string) { return AGENT.some(w => normalize(t).includes(normalize(w))); }

// ---- Pasif Dinleyici ----
async function startListener(page: Page, cityId: string) {
  let lastUrl = "";
  let savedCount = 0;

  setInterval(async () => {
    try {
      const url = page.url();
      if (url === lastUrl) return;
      lastUrl = url;

      if (url.includes("sahibinden.com/ilan/") && !url.includes("giris")) {
        await new Promise(r => setTimeout(r, 2000));
        const idMatch = url.match(/(\d{8,})/);
        if (!idMatch) return;
        const id = idMatch[1];

        const existing = await prisma.listing.findUnique({ where: { sahibindenId: id } });
        if (existing) return;

        const data = await page.evaluate(() => {
          const t = document.querySelector("h1")?.textContent?.trim() || "";
          const d = document.querySelector("#classifiedDescription")?.textContent?.trim() || "";
          const pr = document.querySelector(".classifiedInfo h3")?.textContent?.trim() || "";
          const loc = Array.from(document.querySelectorAll(".classifiedInfo h2 a")).map(a => a.textContent?.trim()).filter(Boolean) as string[];
          const imgs = Array.from(document.querySelectorAll("img[data-src]")).map(i => (i as HTMLImageElement).dataset.src || "").filter(s => s && !s.includes("placeholder")).slice(0, 20);
          const seller = document.querySelector(".username-info-area h5")?.textContent?.trim() || null;
          const info: Record<string, string> = {};
          document.querySelectorAll(".classifiedInfoList li").forEach(li => { const l = li.querySelector("strong")?.textContent?.trim(); const v = li.querySelector("span")?.textContent?.trim(); if (l && v) info[l] = v; });
          return { t, d, price: parseInt(pr.replace(/[^0-9]/g, "")) || null, loc, imgs, seller, info };
        });

        if (!data.t || isAgent(data.t + " " + data.d + " " + (data.seller || ""))) return;

        const cs = normalize(data.t);
        const catSlug = cs.includes("arsa") ? "arsa" : cs.includes("villa") ? "villa" : cs.includes("mustakil") ? "mustakil-ev" : "daire";
        const cat = await prisma.category.findUnique({ where: { slug: catSlug } });
        const isRent = url.includes("kiralik");

        const listing = await prisma.listing.create({
          data: {
            sahibindenId: id, title: data.t, description: data.d.substring(0, 5000),
            price: data.price, currency: "TL", listingType: isRent ? "RENT" : "SALE",
            location: data.loc.join(", ") || "Konya", district: data.loc[1] || null, neighborhood: data.loc[2] || null,
            roomCount: data.info["Oda Sayısı"] || null,
            squareMeters: data.info["m² (Brüt)"] ? parseInt(data.info["m² (Brüt)"].replace(/[^0-9]/g, "")) : null,
            imageUrls: data.imgs, sourceUrl: url,
            sellerName: data.seller || "Sahibinden", sellerPhone: null,
            isFromOwner: true, status: "ACTIVE", cityId, categoryId: cat?.id || null,
          },
        });

        savedCount++;
        console.log(`📥 ${data.t.substring(0, 40)} | ${data.price?.toLocaleString("tr-TR")} TL`);

        // Yeni ilanı müşterilere akıllı dağıt
        await smartAssign(listing.id);
      }
    } catch { /* skip */ }
  }, 2000);

  // Stats
  setInterval(async () => {
    const total = await prisma.listing.count();
    console.log(`📊 ${new Date().toLocaleTimeString("tr-TR")} | Kayıt: ${savedCount} | DB: ${total}`);
  }, 60000);
}

// ---- Akıllı İlan Dağıtımı ----
async function smartAssign(listingId: string) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { listingType: true, price: true, district: true, categoryId: true, cityId: true },
  });
  if (!listing) return;

  // autoAssign aktif müşterileri al
  const preferences = await prisma.customerPreference.findMany({
    where: { autoAssign: true },
    include: { user: { select: { id: true, isActive: true } } },
  });

  for (const pref of preferences) {
    if (!pref.user.isActive) continue;

    // Müşteri tercihlerine uyuyor mu?
    if (pref.listingType && pref.listingType !== listing.listingType) continue;
    if (pref.priceMax && listing.price && listing.price > pref.priceMax) continue;
    if (pref.priceMin && listing.price && listing.price < pref.priceMin) continue;
    if (pref.cityIds.length > 0 && !pref.cityIds.includes(listing.cityId)) continue;
    if (pref.categoryIds.length > 0 && listing.categoryId && !pref.categoryIds.includes(listing.categoryId)) continue;

    // Zaten atanmış mı?
    const existing = await prisma.assignment.findFirst({
      where: { userId: pref.userId, listingId },
    });
    if (existing) continue;

    // Ata
    await prisma.assignment.create({
      data: { userId: pref.userId, listingId, assignedBy: "bot-auto" },
    });

    // Bildirim
    await prisma.userLog.create({
      data: { userId: pref.userId, action: "ADMIN_NOTIFICATION", details: `Yeni ilan: ${listing.district || "Konya"} - tercihlerinize uygun!` },
    });
  }
}

// ---- Sonsuz Gezinti ----
async function infiniteBrowse(page: Page) {
  const categories = [
    "satilik-daire/konya/sahibinden",
    "satilik-mustakil-ev/konya/sahibinden",
    "satilik-arsa/konya/sahibinden",
    "satilik-villa/konya/sahibinden",
    "kiralik-daire/konya/sahibinden",
    "kiralik/konya/sahibinden",
    "satilik-daire/konya/sahibinden?pagingOffset=20",
    "satilik-daire/konya/sahibinden?pagingOffset=40",
    "satilik-mustakil-ev/konya/sahibinden?pagingOffset=20",
    "satilik-arsa/konya/sahibinden?pagingOffset=20",
    "kiralik-daire/konya/sahibinden?pagingOffset=20",
  ];

  let round = 1;

  while (true) {
    console.log(`\n🔄 Round ${round} başlıyor...`);

    for (const cat of categories) {
      const url = `https://www.sahibinden.com/${cat}`;
      console.log(`\n📂 ${cat.split("/")[0]}`);

      // Kategori sayfasına yavaşça git
      await new Promise(r => setTimeout(r, 60000 + Math.random() * 60000));
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 5000));

      // Engel kontrolü
      if (page.url().includes("olagan") || page.url().includes("tloading")) {
        console.log("  ⚠ Engel - 15dk bekleniyor");
        await new Promise(r => setTimeout(r, 900000));
        continue;
      }

      if (page.url().includes("giris") || page.url().includes("login")) {
        console.log("  🔒 Session expired - 30dk bekleniyor");
        await new Promise(r => setTimeout(r, 1800000));
        continue;
      }

      // İnsan davranışı
      for (let i = 0; i < 5; i++) {
        await page.evaluate((s) => window.scrollBy({ top: s, behavior: "smooth" }), 200 + Math.random() * 400);
        await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
        await page.mouse.move(200 + Math.random() * 800, 200 + Math.random() * 600, { steps: 15 });
      }

      // İlan linklerini al
      const links = await page.evaluate(() =>
        Array.from(document.querySelectorAll('tr[data-id] a[href*="/ilan/"]'))
          .map(a => (a as HTMLAnchorElement).href)
          .filter(h => h.includes("/ilan/"))
      ).catch(() => [] as string[]);

      console.log(`  ${links.length} ilan`);

      // Her ilana yavaşça git
      for (const link of links.slice(0, 8)) {
        const waitSec = 180 + Math.random() * 180;
        await new Promise(r => setTimeout(r, waitSec * 1000));

        await page.goto(link, { waitUntil: "networkidle2", timeout: 30000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 3000));

        if (page.url().includes("olagan") || page.url().includes("tloading")) {
          console.log("  ⚠ Engel - 15dk bekle");
          await new Promise(r => setTimeout(r, 900000));
          break;
        }

        // Scroll - oku
        for (let i = 0; i < 5; i++) {
          await page.evaluate((s) => window.scrollBy({ top: s, behavior: "smooth" }), 200 + Math.random() * 400);
          await new Promise(r => setTimeout(r, 1500 + Math.random() * 2500));
        }
        await page.mouse.move(300 + Math.random() * 600, 200 + Math.random() * 400, { steps: 20 });

        // Pasif dinleyici otomatik kaydedecek
      }
    }

    round++;
    console.log(`\n⏰ Round ${round - 1} bitti. 30dk mola...`);
    await new Promise(r => setTimeout(r, 1800000));
  }
}

// ---- Ana ----
async function main() {
  console.log("=== EvSahip Nonstop Bot ===\n");
  console.log("Durmadan çalışır, her müşteriye farklı ilan atar\n");

  let browser;
  try {
    browser = await puppeteer.connect({ browserURL: "http://localhost:9222" });
  } catch {
    console.error("Chrome yok! RDP'den EvSahip-Bot.bat çalıştır.");
    process.exit(1);
  }

  const [page] = await browser.pages();
  const city = await prisma.city.findUnique({ where: { slug: "konya" } });
  if (!city) { console.error("Konya yok"); process.exit(1); }

  // Pasif dinleyiciyi başlat
  startListener(page, city.id);
  console.log("📡 Pasif dinleyici aktif\n");

  // Sonsuz gezinti başlat
  await infiniteBrowse(page);
}

main().catch(e => { console.error(e); process.exit(1); });
