// Hepsiemlak ilçe-bazlı scraper — SADECE ilçe sayfaları (ana sayfalar skip)
// Duplicate-heavy ana kiralık/satılık sayfaları zaten tarandı.
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
const GAYRIMENKUL_RE = /\bgayrimenkul[a-zçğıöşü]*\b/i;
const TWO_CAPS_RE = /\b[A-ZÇĞİÖŞÜ]{3,}\s+[A-ZÇĞİÖŞÜ]{3,}\s+(DAN|DEN|TAN|TEN)(?![a-zA-ZçğıöşüÇĞİÖŞÜ])/;

function isAgent(text, title) {
  const combined = ((title||'') + ' ' + (text||'')).trim();
  const norm = normalize(combined);
  if (AGENT_WORDS.some(w => norm.includes(normalize(w)))) return true;
  if (FIRM_ABLATIVE_RE.test(combined)) return true;
  if (TWO_CAPS_RE.test(title || '')) return true;
  if (/\b(holding|group)\b/i.test(combined)) return true;
  if (EMLAK_COMPOUND_RE.test(norm)) return true;
  if (GAYRIMENKUL_RE.test(norm)) return true;
  if (/\b(yapı|yapi)\s+kooperatif/i.test(combined)) return true;
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
  console.log("=== Hepsiemlak İlçeler ===\n");
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222' });
  const page = await browser.newPage();
  const city = await prisma.city.findUnique({ where: { slug: "konya" } });
  if (!city) { console.error("Konya yok!"); process.exit(1); }

  let accepted = 0, rejected = 0, duplicates = 0, errors = 0;
  const startTime = Date.now();
  const MAX_MS = 30 * 60 * 1000;
  const pages = [];

  // Hepsiemlak ilçe URL formatı: konya-{ilçe}-{kiralik|satilik}-{tip}
  // NOT: konya-selcuklu-kiralik → 404! konya-selcuklu-kiralik-daire → çalışıyor!
  const types = ["daire", "mustakil-ev", "villa", "arsa"];
  const topDistricts = ["selcuklu", "meram", "karatay"];
  const otherDistricts = ["eregli", "aksehir", "beysehir", "seydisehir", "cumra", "ilgin", "kulu", "cihanbeyli"];

  // --- Yeni ilanları yakalamak için: sıralama=yeni eklenen, derin tarama ---
  const allDistricts = [...topDistricts, ...otherDistricts, "hadim","bozkir","taskent","huyuk","altinekin","derbent","derebucak","doganhisar","emirgazi","guneysinir","halkapinar","karapinar","tuzlukcu","yalihuyuk","yunak","celtik","akoren","sarayonu","kadinhani"];
  // Tüm ilçelerde yeni eklenenler (sıralama=yeni eklenen ilan) s.1-3
  for (const d of allDistricts) {
    for (let i = 1; i <= 3; i++) {
      pages.push({ url: `https://www.hepsiemlak.com/konya-${d}-satilik-daire?sirala=yeni-eklenen-ilan&page=${i}`, type: "SALE" });
    }
  }
  // Top 3 ilçe kiralık daire yeni eklenen s.1-5
  for (const d of topDistricts) {
    for (let i = 1; i <= 5; i++) {
      pages.push({ url: `https://www.hepsiemlak.com/konya-${d}-kiralik-daire?sirala=yeni-eklenen-ilan&page=${i}`, type: "RENT" });
    }
  }

  console.log(`${pages.length} ilçe sayfası\n`);

  for (const { url: listUrl, type: listingType } of pages) {
    if (Date.now() - startTime > MAX_MS) { console.log(`\n⏰ Limit`); break; }
    const district = listUrl.match(/konya-([a-z-]+?)-(?:satilik|kiralik)/)?.[1] || '?';
    const pageNum = listUrl.includes('page=') ? listUrl.split('page=')[1] : '1';
    console.log(`\n📂 ${district}/${listingType} s.${pageNum}`);
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
    try {
      await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(r => setTimeout(r, 3000));
      const links = await page.evaluate(() => {
        const results = [], seen = new Set();
        document.querySelectorAll('a').forEach(a => {
          const href = a.href || '';
          const m = href.match(/hepsiemlak\.com\/konya-.+?\/\w+\/(\d+-\d+)/);
          if (m && !seen.has(m[1])) { seen.add(m[1]); results.push({ href, id: 'HE' + m[1] }); }
        });
        return results;
      });
      console.log(`  ${links.length} link`);
      for (const link of links) {
        if (Date.now() - startTime > MAX_MS) break;
        const exists = await prisma.listing.findFirst({ where: { OR: [{ sahibindenId: link.id }, { sourceUrl: link.href }] } });
        if (exists) { duplicates++; continue; }
        await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
        try {
          await page.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await new Promise(r => setTimeout(r, 2500));
          const data = await page.evaluate(() => {
            const title = document.querySelector('h1')?.textContent?.trim() || '';
            let price = null;
            document.querySelectorAll('*').forEach(el => { if (price) return; const t = el.textContent?.trim()||''; if (t.match(/^\s*[\d.]+\s*TL\s*$/)||t.match(/^\s*[\d.]+\s*₺/)) { const n=parseInt(t.replace(/[^0-9]/g,'')); if(n>10000) price=n; } });
            const bodyText = document.body.innerText;
            if (!price) { const pm=bodyText.match(/([\d.]+)\s*TL/); if(pm){const n=parseInt(pm[1].replace(/\./g,'')); if(n>10000)price=n;} }
            const breadcrumbs = Array.from(document.querySelectorAll('a')).filter(a=>a.href.includes('/konya')&&!a.href.includes('/en/')).map(a=>a.textContent?.trim()).filter(t=>t&&t.length<30&&t.toLowerCase()!=='english'&&t.toLowerCase()!=='koyler'&&t!=='Русский');
            const location = breadcrumbs.slice(0,3).join(', ')||'Konya';
            const roomMatch = bodyText.match(/(\d\+\d)\s/);
            const sqmMatch = bodyText.match(/(\d+)\s*m²/);
            const imgs = [];
            document.querySelectorAll('img').forEach(img => { const src=img.src||img.dataset?.src||''; if(src.includes('http')&&!src.includes('logo')&&!src.includes('svg')&&!src.includes('placeholder')) { if(img.width>50||src.includes('hepsiemlak')) imgs.push(src); } });
            let phone = null;
            const phoneMatches = bodyText.match(/(?:\+?90[\s.-]?)?0?5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/g);
            if (phoneMatches) { const d=phoneMatches[0].replace(/\D/g,'').slice(-10); if(d.length===10&&d.startsWith('5')) phone='0'+d; }
            return { title, desc:(document.querySelector('[class*="description"]')?.textContent?.trim()||'').substring(0,3000), price, location, roomCount:roomMatch?roomMatch[1]:null, sqm:sqmMatch?parseInt(sqmMatch[1]):null, images:[...new Set(imgs)].slice(0,15), phone };
          });
          if (!data.title || data.title==='www.hepsiemlak.com') { errors++; continue; }
          if (isAgent(data.desc, data.title)) { rejected++; continue; }
          const finalPrice = (listingType==='RENT' && data.price && data.price>500000) ? null : data.price;
          const categoryId = await guessCategory(data.title);
          const districtName = data.location.split(',')[1]?.trim() || null;
          await prisma.listing.create({ data: {
            sahibindenId: link.id, title: data.title.substring(0,200), description: data.desc,
            price: finalPrice, currency:'TL', listingType, location: data.location,
            district: districtName, roomCount: data.roomCount, squareMeters: data.sqm,
            imageUrls: data.images, sourceUrl: link.href, sellerName:'Sahibinden',
            sellerPhone: data.phone, isFromOwner: true, status:'ACTIVE', cityId: city.id, categoryId,
          }});
          accepted++;
          const priceStr = finalPrice ? `${finalPrice.toLocaleString('tr-TR')} TL` : '?';
          const phoneStr = data.phone ? ` 📞` : '';
          console.log(`  ✓ ${data.title.substring(0,50)} | ${priceStr}${phoneStr}`);
        } catch (err) { errors++; }
      }
    } catch (err) { console.log(`  Hata: ${err.message?.substring(0,30)||''}`); }
  }
  const dur = ((Date.now()-startTime)/1000/60).toFixed(1);
  console.log(`\n${"=".repeat(40)}`);
  console.log(`SONUÇ: ${accepted} yeni | ${rejected} red | ${duplicates} dup | ${errors} hata | ${dur}dk`);
  await page.close(); browser.disconnect(); await prisma.$disconnect(); process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
