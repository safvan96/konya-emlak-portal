// Hepsiemlak.com Chrome scraper - sahibinden ilanlarını çeker
const puppeteer = require('puppeteer');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function normalize(t) {
  const m = {"ç":"c","ğ":"g","ı":"i","ö":"o","ş":"s","ü":"u","Ç":"c","Ğ":"g","İ":"i","Ö":"o","Ş":"s","Ü":"u"};
  return t.replace(/[^\x00-\x7F]/g, c => m[c] || "").toLowerCase();
}

const AGENT_WORDS = ["emlak","gayrimenkul","remax","century","coldwell","turyap","danışman","broker","ofisimiz","portföy","franchise"];
function isAgent(text) {
  const n = normalize(text);
  return AGENT_WORDS.some(w => n.includes(normalize(w)));
}

function humanDelay(minSec, maxSec) {
  const ms = (minSec + Math.random() * (maxSec - minSec)) * 1000;
  return new Promise(r => setTimeout(r, ms));
}

async function guessCategory(title) {
  const lower = title.toLowerCase();
  const map = {
    villa: "villa", arsa: "arsa", tarla: "tarla", "müstakil": "mustakil-ev",
    mustakil: "mustakil-ev", "dükkan": "dukkan", dukkan: "dukkan", daire: "daire",
  };
  for (const [kw, slug] of Object.entries(map)) {
    if (lower.includes(kw)) {
      const cat = await prisma.category.findUnique({ where: { slug } });
      return cat?.id || null;
    }
  }
  const daire = await prisma.category.findUnique({ where: { slug: "daire" } });
  return daire?.id || null;
}

async function main() {
  console.log("=== Hepsiemlak Konya Scraper ===\n");

  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222' });
  const page = await browser.newPage();

  const city = await prisma.city.findUnique({ where: { slug: "konya" } });
  if (!city) { console.error("Konya yok!"); process.exit(1); }

  const scraperRun = await prisma.scraperRun.create({
    data: { cityId: city.id, status: "running" },
  });

  let accepted = 0, rejected = 0, duplicates = 0, errors = 0;
  const startTime = Date.now();

  // Hepsiemlak Konya ilan sayfaları
  const urls = [
    { url: "https://www.hepsiemlak.com/konya-satilik", type: "SALE" },
    { url: "https://www.hepsiemlak.com/konya-satilik?page=2", type: "SALE" },
    { url: "https://www.hepsiemlak.com/konya-satilik?page=3", type: "SALE" },
    { url: "https://www.hepsiemlak.com/konya-satilik?page=4", type: "SALE" },
    { url: "https://www.hepsiemlak.com/konya-satilik?page=5", type: "SALE" },
    { url: "https://www.hepsiemlak.com/konya-kiralik", type: "RENT" },
    { url: "https://www.hepsiemlak.com/konya-kiralik?page=2", type: "RENT" },
  ];

  for (const { url: listUrl, type: listingType } of urls) {
    const isRent = listingType === 'RENT';
    console.log(`\n📂 ${isRent ? 'Kiralık' : 'Satılık'} - Sayfa ${listUrl.includes('page=') ? listUrl.split('page=')[1] : '1'}`);

    await humanDelay(5, 12);

    try {
      await page.goto(listUrl, { waitUntil: 'networkidle2', timeout: 45000 }).catch(() => {});
      await humanDelay(3, 5);

      // İlan kartlarını bekle
      await page.waitForSelector('a[href*="/konya-"], .listing-item, .listItem', { timeout: 10000 }).catch(() => {});
      await humanDelay(1, 3);

      // Scroll
      for (let i = 0; i < 3; i++) {
        await page.evaluate(d => window.scrollBy({ top: d, behavior: 'smooth' }), 300 + Math.random() * 400);
        await humanDelay(0.5, 1.5);
      }

      // İlan linklerini topla
      const links = await page.evaluate(() => {
        const results = [];
        const seen = new Set();
        // Hepsiemlak ilan URL pattern: /konya-...-satilik/daire/123456-78
        document.querySelectorAll('a').forEach(a => {
          const href = a.href || '';
          // ID pattern: sayı-sayı (örn: 125652-1943)
          const idMatch = href.match(/hepsiemlak\.com\/konya-.+?\/\w+\/(\d+-\d+)$/);
          if (idMatch && !seen.has(idMatch[1])) {
            seen.add(idMatch[1]);
            results.push({ href, id: 'HE' + idMatch[1], title: a.textContent?.trim()?.substring(0, 80) || '' });
          }
        });
        return results;
      });

      console.log(`  ${links.length} ilan bulundu`);

      for (const link of links) {
        try {
          // Duplicate kontrolü
          const existing = await prisma.listing.findFirst({
            where: { OR: [{ sahibindenId: link.id }, { sourceUrl: link.href }] }
          });
          if (existing) { duplicates++; continue; }

          await humanDelay(4, 10);

          // Detay sayfasına git
          try {
            await page.goto(link.href, { waitUntil: 'networkidle2', timeout: 45000 });
          } catch { console.log('  Sayfa yavaş...'); }
          await humanDelay(2, 4);

          // Detay çek
          const data = await page.evaluate(() => {
            const title = document.querySelector('h1')?.textContent?.trim() || '';
            const desc = document.querySelector('.description, [class*="description"], [class*="detail-text"]')?.textContent?.trim() || '';
            const priceEl = document.querySelector('[class*="price"], .fiyat, h2');
            let priceText = priceEl?.textContent?.trim() || '';
            const price = parseInt(priceText.replace(/[^0-9]/g, '')) || null;

            // Konum
            const breadcrumbs = Array.from(document.querySelectorAll('a[href*="/konya"]')).map(a => a.textContent?.trim()).filter(Boolean);
            const location = breadcrumbs.join(', ') || 'Konya';

            // Detay bilgileri
            const info = {};
            document.querySelectorAll('li, [class*="spec"], [class*="detail"]').forEach(el => {
              const text = el.textContent?.trim() || '';
              if (text.includes('Oda')) {
                const m = text.match(/(\d\+\d)/);
                if (m) info.roomCount = m[1];
              }
              if (text.includes('m²') || text.includes('Brüt')) {
                const m = text.match(/(\d+)\s*m²/);
                if (m) info.sqm = parseInt(m[1]);
              }
              if (text.includes('Bina Yaşı')) {
                const m = text.match(/(\d+)/);
                if (m) info.age = m[1];
              }
              if (text.includes('Kat')) {
                const m = text.match(/(\d+)/);
                if (m) info.floor = m[1];
              }
            });

            // Fotoğraflar
            const images = [];
            document.querySelectorAll('img[src*="hepsiemlak"], img[data-src*="hepsiemlak"]').forEach(img => {
              const src = img.getAttribute('data-src') || img.src || '';
              if (src && !src.includes('placeholder') && !src.includes('logo') && src.includes('http')) {
                images.push(src);
              }
            });

            // Satıcı
            const seller = document.querySelector('[class*="owner"], [class*="seller"], [class*="user"]')?.textContent?.trim() || null;

            // Telefon
            const phoneEl = document.querySelector('a[href^="tel:"]');
            const phone = phoneEl ? phoneEl.getAttribute('href').replace('tel:', '').trim() : null;

            return { title, desc, price, location, info, images: [...new Set(images)].slice(0, 20), seller, phone };
          });

          if (!data.title) { errors++; continue; }

          // Emlakçı filtresi
          if (isAgent(data.title + ' ' + data.desc + ' ' + (data.seller || ''))) {
            rejected++;
            continue;
          }

          const categoryId = await guessCategory(data.title);
          const district = data.location.split(',')[1]?.trim() || null;

          await prisma.listing.create({
            data: {
              sahibindenId: link.id,
              title: data.title,
              description: (data.desc || '').substring(0, 5000),
              price: data.price,
              currency: 'TL',
              listingType: isRent ? 'RENT' : 'SALE',
              location: data.location || 'Konya',
              district,
              roomCount: data.info.roomCount || null,
              squareMeters: data.info.sqm || null,
              buildingAge: data.info.age || null,
              floor: data.info.floor || null,
              imageUrls: data.images,
              sourceUrl: link.href,
              sellerName: data.seller || 'Sahibinden',
              sellerPhone: data.phone,
              isFromOwner: true,
              status: 'ACTIVE',
              cityId: city.id,
              categoryId,
            },
          });

          accepted++;
          const priceStr = data.price ? `${data.price.toLocaleString('tr-TR')} TL` : '?';
          const phoneStr = data.phone ? ` | 📞` : '';
          console.log(`  ✓ ${data.title.substring(0, 50)} | ${priceStr}${phoneStr}`);

        } catch (err) {
          errors++;
        }
      }

    } catch (err) {
      console.log(`  Sayfa hata: ${err.message?.substring(0, 50)}`);
      errors++;
    }
  }

  const duration = Date.now() - startTime;
  await prisma.scraperRun.update({
    where: { id: scraperRun.id },
    data: { totalFound: accepted + rejected + duplicates, accepted, rejected, duplicates, errors, duration, status: 'completed', completedAt: new Date() },
  });

  console.log(`\n${"=".repeat(50)}`);
  console.log(`SONUÇ:`);
  console.log(`  ✓ ${accepted} yeni ilan`);
  console.log(`  ✗ ${rejected} emlakçı filtrelendi`);
  console.log(`  ↺ ${duplicates} duplicate`);
  console.log(`  ! ${errors} hata`);
  console.log(`  ⏱ ${(duration / 60000).toFixed(1)} dk`);
  console.log(`${"=".repeat(50)}`);

  await page.close();
  browser.disconnect();
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
