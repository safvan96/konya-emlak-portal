// Hepsiemlak ilçe-bazlı odaklı scraper
// Önceki scriptler ana sayfalarda takıldı. Bu sadece ilçe + kiralık sayfalarını hedefliyor.
const puppeteer = require('puppeteer');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function normalize(t) {
  const m = {"ç":"c","ğ":"g","ı":"i","ö":"o","ş":"s","ü":"u","Ç":"c","Ğ":"g","İ":"i","Ö":"o","Ş":"s","Ü":"u"};
  return t.replace(/[^\x00-\x7F]/g, c => m[c] || "").toLowerCase();
}

const AGENT_WORDS = [
  "emlak","gayrimenkul","remax","century","coldwell","turyap","danışman","broker",
  "ofisimiz","portföy","franchise","holding","premium group","keller williams",
  "re/max","realty world","referans no","ilan no:","portföyümüz","şubemiz",
  "profesyonel ekibimiz","müteahhitlik","muteahhitlik","sefergyo","naşal","nasal",
  "sürşen","sursen","süşen","susen"
];
const FIRM_ABLATIVE_RE = /([A-ZÇĞİÖŞÜa-zçğıöşü]{3,})[''][\s]*(DAN|DEN|TAN|TEN|dan|den|tan|ten)(?![a-zA-ZçğıöşüÇĞİÖŞÜ])/;
const EMLAK_COMPOUND_RE = /\bemlak(?!jet\b|net\b|ci\b|cı\b)[a-zçğıöşü]{2,}\b/i;
const GAYRIMENKUL_COMPOUND_RE = /\bgayrimenkul[a-zçğıöşü]*\b/i;
const TWO_WORD_CAPS_ABLATIVE_RE = /\b[A-ZÇĞİÖŞÜ]{3,}\s+[A-ZÇĞİÖŞÜ]{3,}\s+(DAN|DEN|TAN|TEN)(?![a-zA-ZçğıöşüÇĞİÖŞÜ])/;

function isAgent(text, title) {
  const combined = ((title || '') + ' ' + (text || '')).trim();
  const norm = normalize(combined);
  if (AGENT_WORDS.some(w => norm.includes(normalize(w)))) return true;
  if (FIRM_ABLATIVE_RE.test(combined)) return true;
  if (TWO_WORD_CAPS_ABLATIVE_RE.test(title || '')) return true;
  if (/\b(holding|group)\b/i.test(combined)) return true;
  if (EMLAK_COMPOUND_RE.test(norm)) return true;
  if (GAYRIMENKUL_COMPOUND_RE.test(norm)) return true;
  if (/\b(yapı|yapi)\s+kooperatif/i.test(combined)) return true;
  if (/\bi̇?nşaat['']?(tan|ten)?\b/i.test(combined)) return true;
  return false;
}

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
  console.log("=== Hepsiemlak Districts & Kiralık ===\n");

  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222' });
  const page = await browser.newPage();

  const city = await prisma.city.findUnique({ where: { slug: "konya" } });
  if (!city) { console.error("Konya yok!"); process.exit(1); }

  let accepted = 0, rejected = 0, duplicates = 0, errors = 0;
  const startTime = Date.now();
  const MAX_DURATION_MS = 30 * 60 * 1000; // 30 dk max

  // Hedef: İlçe kiralık + ana kiralık sayfa 6-15
  const pages = [];

  // Ana kiralık 6-15
  for (let i = 6; i <= 15; i++) {
    pages.push({ url: `https://www.hepsiemlak.com/konya-kiralik?page=${i}`, type: "RENT" });
  }

  // Top ilçe kiralık ilk 3 sayfa
  for (const d of ["selcuklu", "meram", "karatay"]) {
    for (let i = 1; i <= 3; i++) {
      pages.push({ url: `https://www.hepsiemlak.com/konya-${d}-kiralik?page=${i}`, type: "RENT" });
    }
  }

  // Diğer ilçe kiralık ilk sayfa
  for (const d of ["eregli", "aksehir", "beysehir", "seydisehir", "cumra", "ilgin", "kulu"]) {
    pages.push({ url: `https://www.hepsiemlak.com/konya-${d}-kiralik?page=1`, type: "RENT" });
  }

  // Top ilçe satılık ilk 2 sayfa (henüz derinlemesine taranmadı)
  for (const d of ["cihanbeyli", "cumra", "ilgin", "kulu", "kadinhani", "sarayonu", "akoren"]) {
    pages.push({ url: `https://www.hepsiemlak.com/konya-${d}-satilik?page=1`, type: "SALE" });
  }

  console.log(`Toplam ${pages.length} sayfa planlandı\n`);

  for (const { url: listUrl, type: listingType } of pages) {
    if (Date.now() - startTime > MAX_DURATION_MS) {
      console.log(`\n⏰ ${(MAX_DURATION_MS / 60000)}dk limit doldu`);
      break;
    }

    const district = listUrl.match(/konya-([a-z-]+?)-(?:satilik|kiralik)/)?.[1] || 'ana';
    const pageNum = listUrl.includes('page=') ? listUrl.split('page=')[1] : '1';
    console.log(`\n📂 ${district}/${listingType} s.${pageNum}`);

    await new Promise(r => setTimeout(r, 2500 + Math.random() * 3000));

    try {
      await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(r => setTimeout(r, 3500));

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

      console.log(`  ${links.length} link`);

      for (const link of links) {
        // İç döngüde de zaman limiti kontrolü
        if (Date.now() - startTime > MAX_DURATION_MS) break;

        const exists = await prisma.listing.findFirst({
          where: { OR: [{ sahibindenId: link.id }, { sourceUrl: link.href }] }
        });
        if (exists) { duplicates++; continue; }

        await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));

        try {
          await page.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await new Promise(r => setTimeout(r, 2500));

          const data = await page.evaluate(() => {
            const title = document.querySelector('h1')?.textContent?.trim() || '';
            let price = null;
            document.querySelectorAll('*').forEach(el => {
              if (price) return;
              const t = el.textContent?.trim() || '';
              if (t.match(/^\s*[\d.]+\s*TL\s*$/) || t.match(/^\s*[\d.]+\s*₺/)) {
                const n = parseInt(t.replace(/[^0-9]/g, ''));
                if (n > 10000) price = n;
              }
            });
            const bodyText = document.body.innerText;
            if (!price) {
              const pm = bodyText.match(/([\d.]+)\s*TL/);
              if (pm) { const n = parseInt(pm[1].replace(/\./g, '')); if (n > 10000) price = n; }
            }
            // Breadcrumb: /konya içeren ama /en/ (dil switcher) olmayan
            const breadcrumbs = Array.from(document.querySelectorAll('a'))
              .filter(a => a.href.includes('/konya') && !a.href.includes('/en/') && !a.href.includes('english'))
              .map(a => a.textContent?.trim())
              .filter(t => t && t.length < 30 && t.toLowerCase() !== 'english' && t.toLowerCase() !== 'köyler' && t.toLowerCase() !== 'koyler');
            const location = breadcrumbs.slice(0, 3).join(', ') || 'Konya';
            const roomMatch = bodyText.match(/(\d\+\d)\s/);
            const sqmMatch = bodyText.match(/(\d+)\s*m²/);
            const imgs = [];
            document.querySelectorAll('img').forEach(img => {
              const src = img.src || img.dataset?.src || '';
              if (src.includes('http') && !src.includes('logo') && !src.includes('svg') && !src.includes('placeholder')) {
                if (img.width > 50 || src.includes('hepsiemlak')) imgs.push(src);
              }
            });
            // Telefon
            let phone = null;
            const phoneRe = /(?:\+?90[\s.-]?)?0?5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/g;
            const pm = bodyText.match(phoneRe);
            if (pm && pm.length > 0) {
              const digits = pm[0].replace(/\D/g, '').slice(-10);
              if (digits.length === 10 && digits.startsWith('5')) phone = '0' + digits;
            }
            return {
              title,
              desc: (document.querySelector('[class*="description"]')?.textContent?.trim() || '').substring(0, 3000),
              price, location,
              roomCount: roomMatch ? roomMatch[1] : null,
              sqm: sqmMatch ? parseInt(sqmMatch[1]) : null,
              images: [...new Set(imgs)].slice(0, 15),
              phone,
            };
          });

          if (!data.title || data.title === 'www.hepsiemlak.com') { errors++; continue; }
          if (isAgent(data.desc, data.title)) {
            rejected++;
            continue;
          }

          const categoryId = await guessCategory(data.title);
          const districtName = data.location.split(',')[1]?.trim() || null;

          await prisma.listing.create({
            data: {
              sahibindenId: link.id,
              title: data.title.substring(0, 200),
              description: data.desc,
              price: data.price,
              currency: 'TL',
              listingType: listingType,
              location: data.location,
              district: districtName,
              roomCount: data.roomCount,
              squareMeters: data.sqm,
              imageUrls: data.images,
              sourceUrl: link.href,
              sellerName: 'Sahibinden',
              sellerPhone: data.phone,
              isFromOwner: true,
              status: 'ACTIVE',
              cityId: city.id,
              categoryId,
            },
          });

          accepted++;
          const priceStr = data.price ? `${data.price.toLocaleString('tr-TR')} TL` : '?';
          const phoneStr = data.phone ? ` 📞${data.phone}` : '';
          console.log(`  ✓ ${data.title.substring(0, 50)} | ${priceStr}${phoneStr}`);

        } catch (err) {
          errors++;
        }
      }
    } catch (err) {
      console.log(`  Sayfa hata: ${err.message?.substring(0, 40) || ''}`);
    }
  }

  const dur = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n${"=".repeat(40)}`);
  console.log(`SONUÇ: ${accepted} yeni | ${rejected} emlakçı | ${duplicates} dup | ${errors} hata | ${dur}dk`);
  console.log(`${"=".repeat(40)}`);

  await page.close();
  browser.disconnect();
  await prisma.$disconnect();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
