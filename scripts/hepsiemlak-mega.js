/**
 * Hepsiemlak Mega Scraper - Tüm Konya ilanlarını çeker
 * - Bot algılanmadan çalışır (rastgele delay, insan davranışı)
 * - Duplicate kontrolü yapar
 * - Emlakçı ilanlarını filtreler
 * - İlerleme raporu verir
 */
const puppeteer = require('puppeteer');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function normalize(t) {
  const m = {"ç":"c","ğ":"g","ı":"i","ö":"o","ş":"s","ü":"u","Ç":"c","Ğ":"g","İ":"i","Ö":"o","Ş":"s","Ü":"u"};
  return t.replace(/[^\x00-\x7F]/g, c => m[c] || "").toLowerCase();
}

const AGENT_WORDS = ["emlak","gayrimenkul","remax","century","coldwell","turyap","danışman","broker","ofisimiz","portföy","franchise","keller williams"];
function isAgent(text) { return AGENT_WORDS.some(w => normalize(text).includes(normalize(w))); }

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

function delay(min, max) {
  const ms = min + Math.random() * (max - min);
  return new Promise(r => setTimeout(r, ms));
}

// İlan ID'lerini önce topla (hepsini), sonra detaylara gir
async function collectListingIds(page, listUrl) {
  try {
    await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(3000, 5000);

    const links = await page.evaluate(() => {
      const results = [];
      const seen = new Set();
      document.querySelectorAll('a').forEach(a => {
        const href = a.href || '';
        const idMatch = href.match(/hepsiemlak\.com\/konya-.+?\/\w+\/(\d+-\d+)/);
        if (idMatch && !seen.has(idMatch[1])) {
          seen.add(idMatch[1]);
          results.push({ href, id: 'HE' + idMatch[1] });
        }
      });
      return results;
    });
    return links;
  } catch {
    return [];
  }
}

async function scrapeDetail(page, link, listingType, cityId) {
  try {
    await page.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await delay(2000, 4000);

    const data = await page.evaluate(() => {
      const title = document.querySelector('h1')?.textContent?.trim() || '';

      let price = null;
      const allText = document.body?.innerText || '';
      const pm = allText.match(/([\d.]+)\s*TL/);
      if (pm) { const n = parseInt(pm[1].replace(/\./g, '')); if (n > 10000) price = n; }

      const breadcrumbs = Array.from(document.querySelectorAll('a'))
        .filter(a => a.href.includes('/konya'))
        .map(a => a.textContent?.trim())
        .filter(t => t && t.length < 30);
      const location = breadcrumbs.slice(0, 3).join(', ') || 'Konya';

      const bodyText = document.body?.innerText || '';
      const roomMatch = bodyText.match(/(\d\+\d)\s/);
      const sqmMatch = bodyText.match(/(\d+)\s*m²/);

      const imgs = [];
      document.querySelectorAll('img').forEach(img => {
        const src = img.src || img.dataset?.src || '';
        if (src.includes('http') && !src.includes('logo') && !src.includes('svg') && !src.includes('placeholder') && !src.includes('icon')) {
          if (img.width > 50 || src.includes('hepsiemlak')) imgs.push(src);
        }
      });

      return {
        title,
        desc: (document.querySelector('[class*="description"]')?.textContent?.trim() || '').substring(0, 3000),
        price, location,
        roomCount: roomMatch ? roomMatch[1] : null,
        sqm: sqmMatch ? parseInt(sqmMatch[1]) : null,
        images: [...new Set(imgs)].slice(0, 15),
      };
    });

    if (!data.title) return null;
    if (isAgent(data.title + ' ' + data.desc)) return 'agent';

    const categoryId = await guessCategory(data.title);
    const district = data.location.split(',')[1]?.trim() || null;

    await prisma.listing.create({
      data: {
        sahibindenId: link.id,
        title: data.title.substring(0, 200),
        description: data.desc,
        price: data.price,
        currency: 'TL',
        listingType,
        location: data.location,
        district,
        roomCount: data.roomCount,
        squareMeters: data.sqm,
        imageUrls: data.images,
        sourceUrl: link.href,
        sellerName: 'Sahibinden',
        isFromOwner: true,
        status: 'ACTIVE',
        cityId,
        categoryId,
      },
    });

    return data;
  } catch {
    return null;
  }
}

async function main() {
  console.log("=== Hepsiemlak Mega Scraper ===");
  console.log(`Başlangıç: ${new Date().toLocaleTimeString('tr-TR')}\n`);

  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222' });

  // Mevcut hepsiemlak tablarını kapat
  const allPages = await browser.pages();
  for (const p of allPages) {
    if (p.url().includes('hepsiemlak') && allPages.indexOf(p) > 0) {
      await p.close().catch(() => {});
    }
  }

  const page = await browser.newPage();

  // Stealth ayarları
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1366, height: 768 });

  const city = await prisma.city.findUnique({ where: { slug: "konya" } });
  if (!city) { console.error("Konya yok!"); process.exit(1); }

  let totalAccepted = 0, totalRejected = 0, totalDuplicates = 0, totalErrors = 0;
  const startCount = await prisma.listing.count();

  // Sayfa grupları
  const pageGroups = [];

  // 1) Genel satılık sayfa 1-50
  for (let i = 1; i <= 50; i++) {
    pageGroups.push({ url: `https://www.hepsiemlak.com/konya-satilik?page=${i}`, type: "SALE", label: `Satılık s.${i}` });
  }

  // 2) Genel kiralık sayfa 1-30
  for (let i = 1; i <= 30; i++) {
    pageGroups.push({ url: `https://www.hepsiemlak.com/konya-kiralik?page=${i}`, type: "RENT", label: `Kiralık s.${i}` });
  }

  // 3) İlçe bazlı (daha derin sonuçlar)
  const districts = ["selcuklu","meram","karatay","eregli","aksehir","beysehir","cihanbeyli","seydisehir","kulu","cumra","ilgin","kadinhani","sarayonu","bosna-hersek"];
  for (const d of districts) {
    for (let i = 1; i <= 5; i++) {
      pageGroups.push({ url: `https://www.hepsiemlak.com/konya-${d}-satilik?page=${i}`, type: "SALE", label: `${d} satılık s.${i}` });
    }
  }

  // 4) Ana ilçeler kiralık
  for (const d of ["selcuklu", "meram", "karatay"]) {
    for (let i = 1; i <= 5; i++) {
      pageGroups.push({ url: `https://www.hepsiemlak.com/konya-${d}-kiralik?page=${i}`, type: "RENT", label: `${d} kiralık s.${i}` });
    }
  }

  console.log(`Toplam ${pageGroups.length} sayfa taranacak\n`);

  let emptyPages = 0;

  for (let idx = 0; idx < pageGroups.length; idx++) {
    const { url: listUrl, type: listingType, label } = pageGroups[idx];

    // Sayfa linklerini topla
    await delay(2000, 4000);
    const links = await collectListingIds(page, listUrl);

    if (links.length === 0) {
      emptyPages++;
      // 3 ardışık boş sayfa varsa bu kategorinin sonuna geldik, atla
      if (emptyPages >= 3) {
        // Sonraki farklı kategoriye atla
        const currentBase = listUrl.replace(/\?page=\d+/, '');
        while (idx + 1 < pageGroups.length && pageGroups[idx + 1].url.replace(/\?page=\d+/, '') === currentBase) {
          idx++;
        }
        emptyPages = 0;
      }
      continue;
    }
    emptyPages = 0;

    // Duplicate kontrolü toplu yap
    const existingIds = await prisma.listing.findMany({
      where: { sahibindenId: { in: links.map(l => l.id) } },
      select: { sahibindenId: true },
    });
    const existingSet = new Set(existingIds.map(e => e.sahibindenId));
    const newLinks = links.filter(l => !existingSet.has(l.id));
    const dupCount = links.length - newLinks.length;
    totalDuplicates += dupCount;

    let pageAccepted = 0, pageRejected = 0;

    process.stdout.write(`[${idx+1}/${pageGroups.length}] ${label}: ${links.length} ilan (${newLinks.length} yeni) `);

    for (const link of newLinks) {
      await delay(2000, 5000);
      const result = await scrapeDetail(page, link, listingType, city.id);

      if (result === 'agent') {
        pageRejected++;
        totalRejected++;
      } else if (result) {
        pageAccepted++;
        totalAccepted++;
        process.stdout.write('.');
      } else {
        totalErrors++;
      }
    }

    console.log(` +${pageAccepted} yeni${pageRejected ? ` (${pageRejected} emlakçı)` : ''}`);

    // Her 10 sayfada özet
    if ((idx + 1) % 10 === 0) {
      const currentCount = await prisma.listing.count();
      console.log(`\n--- ÖZET [${idx+1}/${pageGroups.length}] ---`);
      console.log(`DB: ${currentCount} (+${currentCount - startCount} yeni)`);
      console.log(`Kabul: ${totalAccepted} | Emlakçı: ${totalRejected} | Dup: ${totalDuplicates} | Hata: ${totalErrors}`);
      console.log(`Saat: ${new Date().toLocaleTimeString('tr-TR')}\n`);
    }
  }

  // Final
  const finalCount = await prisma.listing.count();
  console.log(`\n${"=".repeat(50)}`);
  console.log(`TAMAMLANDI!`);
  console.log(`DB: ${startCount} → ${finalCount} (+${finalCount - startCount} yeni ilan)`);
  console.log(`Kabul: ${totalAccepted} | Emlakçı: ${totalRejected} | Dup: ${totalDuplicates} | Hata: ${totalErrors}`);
  console.log(`Bitiş: ${new Date().toLocaleTimeString('tr-TR')}`);
  console.log(`${"=".repeat(50)}`);

  await page.close();
  browser.disconnect();
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
