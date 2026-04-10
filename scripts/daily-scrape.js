// Günlük otomatik tarama - Hepsiemlak ilk 5 sayfa (yeni ilanlar)
// PM2 cron veya Windows Task Scheduler ile çalıştırılır
const puppeteer = require('puppeteer');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function normalize(t) {
  const m = {"ç":"c","ğ":"g","ı":"i","ö":"o","ş":"s","ü":"u","Ç":"c","Ğ":"g","İ":"i","Ö":"o","Ş":"s","Ü":"u"};
  return t.replace(/[^\x00-\x7F]/g, c => m[c] || "").toLowerCase();
}
const AGENT_WORDS = ["emlak","gayrimenkul","remax","century","coldwell","turyap","danışman","broker","ofisimiz","portföy","franchise"];
function isAgent(text) { return AGENT_WORDS.some(w => normalize(text).includes(normalize(w))); }

async function guessCategory(title) {
  const lower = title.toLowerCase();
  const map = { villa:"villa", arsa:"arsa", "müstakil":"mustakil-ev", mustakil:"mustakil-ev", daire:"daire" };
  for (const [kw, slug] of Object.entries(map)) {
    if (lower.includes(kw)) {
      const cat = await prisma.category.findUnique({ where: { slug } });
      return cat?.id || null;
    }
  }
  const d = await prisma.category.findUnique({ where: { slug: "daire" } });
  return d?.id || null;
}

async function main() {
  const now = new Date().toLocaleString('tr-TR');
  console.log(`=== Günlük Tarama ${now} ===\n`);

  let browser;
  try {
    browser = await puppeteer.connect({ browserURL: 'http://localhost:9222' });
  } catch {
    console.log('Chrome yok, yeni başlatılıyor...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }

  const page = await browser.newPage();
  const city = await prisma.city.findUnique({ where: { slug: "konya" } });
  if (!city) { console.error("Konya yok!"); process.exit(1); }

  let accepted = 0, rejected = 0, duplicates = 0, errors = 0;

  const pages = [
    { url: "https://www.hepsiemlak.com/konya-satilik", type: "SALE" },
    { url: "https://www.hepsiemlak.com/konya-satilik?page=2", type: "SALE" },
    { url: "https://www.hepsiemlak.com/konya-satilik?page=3", type: "SALE" },
    { url: "https://www.hepsiemlak.com/konya-kiralik", type: "RENT" },
    { url: "https://www.hepsiemlak.com/konya-kiralik?page=2", type: "RENT" },
  ];

  for (const { url: listUrl, type: listingType } of pages) {
    await new Promise(r => setTimeout(r, 3000 + Math.random() * 5000));
    try {
      await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(r => setTimeout(r, 5000));

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

      for (const link of links) {
        const exists = await prisma.listing.findFirst({
          where: { OR: [{ sahibindenId: link.id }, { sourceUrl: link.href }] }
        });
        if (exists) { duplicates++; continue; }

        await new Promise(r => setTimeout(r, 3000 + Math.random() * 6000));
        try {
          await page.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await new Promise(r => setTimeout(r, 3000));

          const data = await page.evaluate(() => {
            const title = document.querySelector('h1')?.textContent?.trim() || '';
            let price = null;
            const allText = document.body.innerText;
            const pm = allText.match(/([\d.]+)\s*TL/);
            if (pm) { const n = parseInt(pm[1].replace(/\./g, '')); if (n > 10000) price = n; }
            const breadcrumbs = Array.from(document.querySelectorAll('a')).filter(a => a.href.includes('/konya')).map(a => a.textContent?.trim()).filter(t => t && t.length < 30);
            const location = breadcrumbs.slice(0, 3).join(', ') || 'Konya';
            const roomMatch = allText.match(/(\d\+\d)\s/);
            const sqmMatch = allText.match(/(\d+)\s*m²/);
            const imgs = [];
            document.querySelectorAll('img').forEach(img => {
              const src = img.src || img.dataset?.src || '';
              if (src.includes('http') && !src.includes('logo') && !src.includes('svg') && !src.includes('placeholder')) {
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

          if (!data.title) { errors++; continue; }
          if (isAgent(data.title + ' ' + data.desc)) { rejected++; continue; }

          const categoryId = await guessCategory(data.title);
          await prisma.listing.create({
            data: {
              sahibindenId: link.id, title: data.title.substring(0, 200),
              description: data.desc, price: data.price, currency: 'TL',
              listingType, location: data.location,
              district: data.location.split(',')[1]?.trim() || null,
              roomCount: data.roomCount, squareMeters: data.sqm,
              imageUrls: data.images, sourceUrl: link.href,
              sellerName: 'Sahibinden', isFromOwner: true, status: 'ACTIVE',
              cityId: city.id, categoryId,
            },
          });
          accepted++;
          console.log(`✓ ${data.title.substring(0, 50)} | ${data.price?.toLocaleString('tr-TR') || '?'} TL`);
        } catch { errors++; }
      }
    } catch { errors++; }
  }

  console.log(`\nSONUÇ: ${accepted} yeni | ${rejected} emlakçı | ${duplicates} dup | ${errors} hata`);

  await page.close().catch(() => {});
  try { browser.disconnect(); } catch { await browser.close().catch(() => {}); }
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
