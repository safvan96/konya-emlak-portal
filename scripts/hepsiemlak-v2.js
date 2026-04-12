/**
 * Hepsiemlak V2 - Scroll + lazy load desteği
 * Sayfaları scroll ederek tüm ilanları yükler
 */
const puppeteer = require('puppeteer');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function normalize(t) {
  const m = {"ç":"c","ğ":"g","ı":"i","ö":"o","ş":"s","ü":"u","Ç":"c","Ğ":"g","İ":"i","Ö":"o","Ş":"s","Ü":"u"};
  return t.replace(/[^\x00-\x7F]/g, c => m[c] || "").toLowerCase();
}
const AGENT_WORDS = ["emlak","gayrimenkul","remax","century","coldwell","turyap","danışman","broker","ofisimiz","portföy","franchise","keller"];
function isAgent(text) { return AGENT_WORDS.some(w => normalize(text).includes(normalize(w))); }

function delay(min, max) { return new Promise(r => setTimeout(r, min + Math.random() * (max - min))); }

let catCache = {};
async function guessCategory(title) {
  const lower = title.toLowerCase();
  const map = { villa:"villa", arsa:"arsa", "müstakil":"mustakil-ev", mustakil:"mustakil-ev" };
  for (const [kw, slug] of Object.entries(map)) {
    if (lower.includes(kw)) {
      if (!catCache[slug]) catCache[slug] = await prisma.category.findUnique({ where: { slug } });
      return catCache[slug]?.id || null;
    }
  }
  if (!catCache["daire"]) catCache["daire"] = await prisma.category.findUnique({ where: { slug: "daire" } });
  return catCache["daire"]?.id || null;
}

async function scrollAndCollect(page) {
  // Scroll to bottom to load all listings
  let prevHeight = 0;
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await delay(1500, 2500);
    const newHeight = await page.evaluate(() => document.body.scrollHeight);
    if (newHeight === prevHeight) break;
    prevHeight = newHeight;
  }

  // Collect all listing links
  const links = await page.evaluate(() => {
    const results = [];
    const seen = new Set();
    // Hepsiemlak listing links contain numeric IDs like 166313-8
    document.querySelectorAll('a[href]').forEach(a => {
      const href = a.href || '';
      // Pattern: /konya-...-satilik/daire/12345-67 or similar
      const idMatch = href.match(/hepsiemlak\.com\/[^?#]+\/(\d+-\d+)(?:\?|$|#)/);
      if (!idMatch) {
        // Also try without trailing stuff
        const idMatch2 = href.match(/hepsiemlak\.com\/[^?#]+\/(\d+-\d+)/);
        if (idMatch2 && !seen.has(idMatch2[1])) {
          seen.add(idMatch2[1]);
          results.push({ href, id: 'HE' + idMatch2[1] });
        }
      } else if (!seen.has(idMatch[1])) {
        seen.add(idMatch[1]);
        results.push({ href, id: 'HE' + idMatch[1] });
      }
    });
    return results;
  });

  return links;
}

async function scrapeDetail(page, link, listingType, cityId) {
  try {
    await page.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await delay(2000, 4000);

    // Scroll down to load all content
    for (let i = 0; i < 3; i++) {
      await page.evaluate((s) => window.scrollBy(0, s), 400 + Math.random() * 300);
      await delay(500, 1000);
    }

    const data = await page.evaluate(() => {
      const title = document.querySelector('h1')?.textContent?.trim() || '';

      // Price - look for TL pattern
      let price = null;
      const priceEl = document.querySelector('[class*="price"], [class*="Price"], [data-testid*="price"]');
      if (priceEl) {
        const n = parseInt(priceEl.textContent.replace(/[^0-9]/g, ''));
        if (n > 10000) price = n;
      }
      if (!price) {
        const allText = document.body?.innerText || '';
        const pm = allText.match(/([\d.]+)\s*TL/);
        if (pm) { const n = parseInt(pm[1].replace(/\./g, '')); if (n > 10000) price = n; }
      }

      // Location from breadcrumbs
      const breadcrumbs = Array.from(document.querySelectorAll('a'))
        .filter(a => a.href && a.href.includes('/konya'))
        .map(a => a.textContent?.trim())
        .filter(t => t && t.length < 30 && t.length > 1);
      const location = breadcrumbs.slice(0, 3).join(', ') || 'Konya';

      // Room count and sqm
      const bodyText = document.body?.innerText || '';
      const roomMatch = bodyText.match(/(\d\+\d)\s/);
      const sqmMatch = bodyText.match(/(\d+)\s*m²/);

      // Images
      const imgs = new Set();
      document.querySelectorAll('img[src], img[data-src]').forEach(img => {
        const src = img.src || img.dataset?.src || '';
        if (src.startsWith('http') && !src.includes('logo') && !src.includes('svg') &&
            !src.includes('placeholder') && !src.includes('icon') && !src.includes('avatar') &&
            (src.includes('hepsiemlak') || src.includes('listing') || img.width > 100)) {
          imgs.add(src);
        }
      });

      // Description
      const descEl = document.querySelector('[class*="description"], [class*="Description"], [data-testid*="description"]');
      const desc = descEl?.textContent?.trim() || '';

      // Seller info
      const sellerEl = document.querySelector('[class*="seller"], [class*="Seller"], [class*="owner"]');
      const seller = sellerEl?.textContent?.trim() || '';

      return { title, desc: desc.substring(0, 3000), price, location,
        roomCount: roomMatch ? roomMatch[1] : null,
        sqm: sqmMatch ? parseInt(sqmMatch[1]) : null,
        images: [...imgs].slice(0, 15), seller };
    });

    if (!data.title) return null;
    if (isAgent(data.title + ' ' + data.desc + ' ' + data.seller)) return 'agent';

    const categoryId = await guessCategory(data.title);
    const district = data.location.split(',')[1]?.trim() || null;

    await prisma.listing.create({
      data: {
        sahibindenId: link.id, title: data.title.substring(0, 200),
        description: data.desc, price: data.price, currency: 'TL',
        listingType, location: data.location, district,
        roomCount: data.roomCount, squareMeters: data.sqm,
        imageUrls: data.images, sourceUrl: link.href,
        sellerName: 'Sahibinden', isFromOwner: true,
        status: 'ACTIVE', cityId, categoryId,
      },
    });
    return data;
  } catch { return null; }
}

async function main() {
  console.log("=== Hepsiemlak V2 (Scroll + Lazy Load) ===");
  console.log(`Başlangıç: ${new Date().toLocaleTimeString('tr-TR')}\n`);

  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222' });
  const page = (await browser.pages())[0]; // Mevcut tabı kullan

  await page.setViewport({ width: 1366, height: 768 });

  const city = await prisma.city.findUnique({ where: { slug: "konya" } });
  if (!city) { console.error("Konya yok!"); process.exit(1); }

  const startCount = await prisma.listing.count();
  let totalAccepted = 0, totalRejected = 0, totalDuplicates = 0, totalErrors = 0;

  // URL grupları - daha spesifik kategoriler
  const urls = [];

  // Satılık kategoriler
  const saleCategories = [
    "konya-satilik", "konya-satilik/daire", "konya-satilik/mustakil-ev",
    "konya-satilik/arsa", "konya-satilik/villa", "konya-satilik/residence",
    // İlçe bazlı
    "konya-selcuklu-satilik", "konya-meram-satilik", "konya-karatay-satilik",
    "konya-eregli-satilik", "konya-aksehir-satilik", "konya-beysehir-satilik",
    "konya-seydisehir-satilik", "konya-cihanbeyli-satilik", "konya-cumra-satilik",
    "konya-kulu-satilik", "konya-ilgin-satilik",
    // İlçe + kategori
    "konya-selcuklu-satilik/daire", "konya-meram-satilik/daire", "konya-karatay-satilik/daire",
    "konya-selcuklu-satilik/arsa", "konya-meram-satilik/arsa",
  ];

  const rentCategories = [
    "konya-kiralik", "konya-kiralik/daire",
    "konya-selcuklu-kiralik", "konya-meram-kiralik", "konya-karatay-kiralik",
  ];

  for (const cat of saleCategories) {
    for (let p = 1; p <= 15; p++) {
      urls.push({ url: `https://www.hepsiemlak.com/${cat}?page=${p}`, type: "SALE", label: cat.split('/').pop() || cat });
    }
  }
  for (const cat of rentCategories) {
    for (let p = 1; p <= 10; p++) {
      urls.push({ url: `https://www.hepsiemlak.com/${cat}?page=${p}`, type: "RENT", label: cat });
    }
  }

  console.log(`Toplam ${urls.length} sayfa taranacak\n`);

  let emptyCount = 0;
  let lastLabel = '';

  for (let i = 0; i < urls.length; i++) {
    const { url: listUrl, type: listingType, label } = urls[i];

    if (label !== lastLabel) { emptyCount = 0; lastLabel = label; }

    // 3 ardışık boş → atla
    if (emptyCount >= 3) {
      const nextDiff = urls.findIndex((u, j) => j > i && u.label !== label);
      if (nextDiff > 0) { i = nextDiff - 1; emptyCount = 0; }
      continue;
    }

    await delay(3000, 6000);

    try {
      await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await delay(3000, 5000);

      const links = await scrollAndCollect(page);

      if (links.length === 0) {
        emptyCount++;
        continue;
      }
      emptyCount = 0;

      // Duplicate toplu kontrol
      const existingIds = await prisma.listing.findMany({
        where: { sahibindenId: { in: links.map(l => l.id) } },
        select: { sahibindenId: true },
      });
      const existingSet = new Set(existingIds.map(e => e.sahibindenId));
      const newLinks = links.filter(l => !existingSet.has(l.id));
      totalDuplicates += (links.length - newLinks.length);

      if (newLinks.length === 0) {
        console.log(`[${i+1}] ${label} s.${listUrl.split('page=')[1]}: ${links.length} ilan (tümü dup)`);
        continue;
      }

      process.stdout.write(`[${i+1}] ${label} s.${listUrl.split('page=')[1]}: ${links.length} ilan (${newLinks.length} yeni) `);

      let pageAccepted = 0, pageRejected = 0;

      for (const link of newLinks) {
        await delay(3000, 6000);
        const result = await scrapeDetail(page, link, listingType, city.id);
        if (result === 'agent') { pageRejected++; totalRejected++; }
        else if (result) { pageAccepted++; totalAccepted++; process.stdout.write('.'); }
        else { totalErrors++; }
      }

      console.log(` +${pageAccepted}${pageRejected ? ` (${pageRejected} emlakçı)` : ''}`);

    } catch (err) {
      totalErrors++;
    }

    // Her 20 sayfada özet
    if ((i + 1) % 20 === 0) {
      const currentCount = await prisma.listing.count();
      console.log(`\n--- ÖZET [${i+1}/${urls.length}] | DB: ${currentCount} (+${currentCount - startCount}) | Kabul: ${totalAccepted} | Emlakçı: ${totalRejected} | Dup: ${totalDuplicates} ---\n`);
    }
  }

  const finalCount = await prisma.listing.count();
  console.log(`\n${"=".repeat(50)}`);
  console.log(`TAMAMLANDI! DB: ${startCount} → ${finalCount} (+${finalCount - startCount} yeni ilan)`);
  console.log(`Kabul: ${totalAccepted} | Emlakçı: ${totalRejected} | Dup: ${totalDuplicates} | Hata: ${totalErrors}`);
  console.log(`${"=".repeat(50)}`);

  browser.disconnect();
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
