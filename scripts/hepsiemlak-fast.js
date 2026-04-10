// Hepsiemlak hızlı scraper - Chrome üzerinden
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
  console.log("=== Hepsiemlak Fast Scraper ===\n");

  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222' });
  const page = await browser.newPage();

  const city = await prisma.city.findUnique({ where: { slug: "konya" } });
  if (!city) { console.error("Konya yok!"); process.exit(1); }

  let accepted = 0, rejected = 0, duplicates = 0, errors = 0;

  // Sayfa listesini otomatik oluştur
  const pages = [];

  // Satılık - sayfa 11'den 50'ye kadar (öncekiler zaten çekildi)
  for (let i = 11; i <= 50; i++) {
    pages.push({ url: `https://www.hepsiemlak.com/konya-satilik?page=${i}`, type: "SALE" });
  }

  // Kiralık - sayfa 6'dan 30'a kadar
  for (let i = 6; i <= 30; i++) {
    pages.push({ url: `https://www.hepsiemlak.com/konya-kiralik?page=${i}`, type: "RENT" });
  }

  // İlçe bazlı satılık (daha derin sonuçlar)
  const districts = [
    "selcuklu", "meram", "karatay", "bosna-hersek", "cihanbeyli",
    "eregli", "akoren", "aksehir", "beysehir", "seydisehir",
    "kulu", "cumra", "ilgin", "kadinhani", "sarayonu"
  ];
  for (const d of districts) {
    for (let i = 1; i <= 10; i++) {
      pages.push({ url: `https://www.hepsiemlak.com/konya-${d}-satilik?page=${i}`, type: "SALE" });
    }
  }

  // İlçe bazlı kiralık (ana 3 ilçe)
  for (const d of ["selcuklu", "meram", "karatay"]) {
    for (let i = 1; i <= 10; i++) {
      pages.push({ url: `https://www.hepsiemlak.com/konya-${d}-kiralik?page=${i}`, type: "RENT" });
    }
  }

  for (const { url: listUrl, type: listingType } of pages) {
    const pageNum = listUrl.includes('page=') ? listUrl.split('page=')[1] : '1';
    console.log(`\n📂 ${listingType === 'RENT' ? 'Kiralık' : 'Satılık'} sayfa ${pageNum}`);

    await new Promise(r => setTimeout(r, 3000 + Math.random() * 5000));

    try {
      await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(r => setTimeout(r, 5000));

      // İlan linklerini topla
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

      console.log(`  ${links.length} ilan`);

      for (const link of links) {
        // Duplicate
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

            // Fiyat - birden fazla yerde arayalım
            let price = null;
            document.querySelectorAll('*').forEach(el => {
              if (price) return;
              const t = el.textContent?.trim() || '';
              if (t.match(/^\s*[\d.]+\s*TL\s*$/) || t.match(/^\s*[\d.]+\s*₺/)) {
                const n = parseInt(t.replace(/[^0-9]/g, ''));
                if (n > 10000) price = n;
              }
            });
            if (!price) {
              const allText = document.body.innerText;
              const pm = allText.match(/([\d.]+)\s*TL/);
              if (pm) { const n = parseInt(pm[1].replace(/\./g, '')); if (n > 10000) price = n; }
            }

            // Konum
            const breadcrumbs = Array.from(document.querySelectorAll('a')).filter(a => a.href.includes('/konya')).map(a => a.textContent?.trim()).filter(t => t && t.length < 30);
            const location = breadcrumbs.slice(0, 3).join(', ') || 'Konya';

            // Oda, m2
            const bodyText = document.body.innerText;
            const roomMatch = bodyText.match(/(\d\+\d)\s/);
            const sqmMatch = bodyText.match(/(\d+)\s*m²/);

            // Fotoğraflar
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
              price,
              location,
              roomCount: roomMatch ? roomMatch[1] : null,
              sqm: sqmMatch ? parseInt(sqmMatch[1]) : null,
              images: [...new Set(imgs)].slice(0, 15),
              seller: null,
            };
          });

          if (!data.title) { errors++; continue; }
          if (isAgent(data.title + ' ' + data.desc)) { rejected++; continue; }

          const categoryId = await guessCategory(data.title);
          const district = data.location.split(',')[1]?.trim() || null;

          await prisma.listing.create({
            data: {
              sahibindenId: link.id,
              title: data.title.substring(0, 200),
              description: data.desc,
              price: data.price,
              currency: 'TL',
              listingType: listingType,
              location: data.location,
              district,
              roomCount: data.roomCount,
              squareMeters: data.sqm,
              imageUrls: data.images,
              sourceUrl: link.href,
              sellerName: 'Sahibinden',
              isFromOwner: true,
              status: 'ACTIVE',
              cityId: city.id,
              categoryId,
            },
          });

          accepted++;
          const priceStr = data.price ? `${data.price.toLocaleString('tr-TR')} TL` : '?';
          console.log(`  ✓ ${data.title.substring(0, 50)} | ${priceStr}`);

        } catch (err) {
          errors++;
        }
      }
    } catch (err) {
      console.log(`  Sayfa hata: ${err.message?.substring(0, 40) || ''}`);
    }
  }

  console.log(`\n${"=".repeat(40)}`);
  console.log(`SONUÇ: ${accepted} yeni | ${rejected} emlakçı | ${duplicates} dup | ${errors} hata`);
  console.log(`${"=".repeat(40)}`);

  await page.close();
  browser.disconnect();
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
