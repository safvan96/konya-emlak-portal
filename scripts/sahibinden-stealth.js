/**
 * Sahibinden Stealth Bot - İnsan gibi davranarak ilan çeker
 * - Mevcut Chrome session'ını kullanır (login gerekli değil)
 * - Rastgele delay + mouse movement + scroll
 * - Engel algılama ve bekleme
 * - Her kategoriyi yavaşça gezer
 */
const puppeteer = require('puppeteer');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function normalize(t) {
  const m = {"ç":"c","ğ":"g","ı":"i","ö":"o","ş":"s","ü":"u","Ç":"c","Ğ":"g","İ":"i","Ö":"o","Ş":"s","Ü":"u"};
  return t.replace(/[^\x00-\x7F]/g, c => m[c] || "").toLowerCase();
}

const AGENT_WORDS = ["emlak","gayrimenkul","remax","century","coldwell","turyap","danışman","broker","ofisimiz","portföy","franchise","keller","danismanlik","profesyonel ekib"];
function isAgent(text) { return AGENT_WORDS.some(w => normalize(text).includes(normalize(w))); }

function delay(min, max) { return new Promise(r => setTimeout(r, min + Math.random() * (max - min))); }

let catCache = {};
async function guessCategory(title) {
  const lower = title.toLowerCase();
  const map = { villa:"villa", arsa:"arsa", tarla:"arsa", "müstakil":"mustakil-ev", mustakil:"mustakil-ev" };
  for (const [kw, slug] of Object.entries(map)) {
    if (lower.includes(kw)) {
      if (!catCache[slug]) catCache[slug] = await prisma.category.findUnique({ where: { slug } });
      return catCache[slug]?.id || null;
    }
  }
  if (!catCache["daire"]) catCache["daire"] = await prisma.category.findUnique({ where: { slug: "daire" } });
  return catCache["daire"]?.id || null;
}

async function humanScroll(page) {
  for (let i = 0; i < 3 + Math.floor(Math.random() * 4); i++) {
    await page.evaluate((s) => window.scrollBy({ top: s, behavior: 'smooth' }), 200 + Math.random() * 400);
    await delay(800, 2000);
    // Rastgele mouse hareketi
    await page.mouse.move(
      200 + Math.random() * 800,
      200 + Math.random() * 400,
      { steps: 5 + Math.floor(Math.random() * 10) }
    );
  }
}

async function checkBlocked(page) {
  const url = page.url();
  if (url.includes('olagan') || url.includes('tloading') || url.includes('captcha')) {
    return 'captcha';
  }
  if (url.includes('giris') || url.includes('login')) {
    return 'login';
  }
  // Sayfa içeriğini kontrol
  const blocked = await page.evaluate(() => {
    const text = document.body?.innerText || '';
    return text.includes('olağandışı') || text.includes('güvenlik') || text.includes('robot');
  }).catch(() => false);
  return blocked ? 'content-block' : false;
}

async function getListingLinks(page) {
  return page.evaluate(() => {
    const links = [];
    const seen = new Set();
    // Tablo satırlarından
    document.querySelectorAll('tr[data-id]').forEach(tr => {
      const a = tr.querySelector('a[href*="/ilan/"]');
      const id = tr.getAttribute('data-id');
      if (a && id && !seen.has(id)) {
        seen.add(id);
        links.push({ href: a.href, id });
      }
    });
    // Alternatif: kart yapısı
    if (links.length === 0) {
      document.querySelectorAll('a[href*="/ilan/"]').forEach(a => {
        const idMatch = a.href.match(/(\d{8,})/);
        if (idMatch && !seen.has(idMatch[1])) {
          seen.add(idMatch[1]);
          links.push({ href: a.href, id: idMatch[1] });
        }
      });
    }
    return links;
  }).catch(() => []);
}

async function scrapeDetail(page, cityId) {
  try {
    await delay(2000, 4000);
    await humanScroll(page);

    const blocked = await checkBlocked(page);
    if (blocked) return { status: blocked };

    const data = await page.evaluate(() => {
      const title = document.querySelector('h1')?.textContent?.trim() || '';
      const desc = document.querySelector('#classifiedDescription')?.textContent?.trim() || '';
      const priceEl = document.querySelector('.classifiedInfo h3');
      const priceText = priceEl?.textContent?.trim() || '';
      const price = parseInt(priceText.replace(/[^0-9]/g, '')) || null;

      const loc = Array.from(document.querySelectorAll('.classifiedInfo h2 a'))
        .map(a => a.textContent?.trim()).filter(Boolean);

      const imgs = Array.from(document.querySelectorAll('img[data-src], img.stdImg'))
        .map(i => i.dataset?.src || i.src || '')
        .filter(s => s && s.startsWith('http') && !s.includes('placeholder') && !s.includes('logo'))
        .slice(0, 20);

      const seller = document.querySelector('.username-info-area h5')?.textContent?.trim() || null;

      const info = {};
      document.querySelectorAll('.classifiedInfoList li').forEach(li => {
        const label = li.querySelector('strong')?.textContent?.trim();
        const value = li.querySelector('span')?.textContent?.trim();
        if (label && value) info[label] = value;
      });

      const url = window.location.href;
      const idMatch = url.match(/(\d{8,})/);

      return {
        title, desc: desc.substring(0, 5000), price, loc,
        imgs, seller, info, url,
        id: idMatch ? idMatch[1] : null,
        isRent: url.includes('kiralik'),
      };
    });

    if (!data.title || !data.id) return { status: 'no-data' };

    // Duplicate kontrolü
    const existing = await prisma.listing.findUnique({ where: { sahibindenId: data.id } });
    if (existing) return { status: 'duplicate' };

    // Emlakçı kontrolü
    const fullText = data.title + ' ' + data.desc + ' ' + (data.seller || '');
    if (isAgent(fullText)) return { status: 'agent', title: data.title };

    const categoryId = await guessCategory(data.title);
    const district = data.loc[1] || null;
    const neighborhood = data.loc[2] || null;

    await prisma.listing.create({
      data: {
        sahibindenId: data.id,
        title: data.title.substring(0, 200),
        description: data.desc,
        price: data.price,
        currency: 'TL',
        listingType: data.isRent ? 'RENT' : 'SALE',
        location: data.loc.join(', ') || 'Konya',
        district, neighborhood,
        roomCount: data.info['Oda Sayısı'] || null,
        squareMeters: data.info['m² (Brüt)'] ? parseInt(data.info['m² (Brüt)'].replace(/[^0-9]/g, '')) : null,
        imageUrls: data.imgs,
        sourceUrl: data.url,
        sellerName: data.seller || 'Sahibinden',
        isFromOwner: true,
        status: 'ACTIVE',
        cityId,
        categoryId,
      },
    });

    return { status: 'saved', title: data.title, price: data.price };
  } catch (err) {
    return { status: 'error', message: err.message?.substring(0, 50) };
  }
}

async function main() {
  console.log("=== Sahibinden Stealth Bot ===");
  console.log(`Başlangıç: ${new Date().toLocaleTimeString('tr-TR')}\n`);

  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222' });

  // İlk mevcut sahibinden tabını bul
  const allPages = await browser.pages();
  let page = null;
  for (const p of allPages) {
    const url = p.url();
    if (url.includes('sahibinden.com') && !url.includes('giris') && !url.includes('google') && !url.includes('safe')) {
      page = p;
      break;
    }
  }
  if (!page) {
    page = allPages[0]; // İlk tabı kullan
  }

  const city = await prisma.city.findUnique({ where: { slug: 'konya' } });
  if (!city) { console.error('Konya yok!'); process.exit(1); }

  const startCount = await prisma.listing.count();
  let totalSaved = 0, totalAgent = 0, totalDup = 0, totalError = 0, totalBlocked = 0;

  // Kategoriler - her biri bir liste sayfası
  const categories = [
    { url: 'https://www.sahibinden.com/satilik-daire/konya', label: 'Satılık Daire' },
    { url: 'https://www.sahibinden.com/satilik-daire/konya?pagingOffset=20', label: 'Satılık Daire s.2' },
    { url: 'https://www.sahibinden.com/satilik-daire/konya?pagingOffset=40', label: 'Satılık Daire s.3' },
    { url: 'https://www.sahibinden.com/satilik-daire/konya?pagingOffset=60', label: 'Satılık Daire s.4' },
    { url: 'https://www.sahibinden.com/satilik-daire/konya?pagingOffset=80', label: 'Satılık Daire s.5' },
    { url: 'https://www.sahibinden.com/satilik-daire/konya?pagingOffset=100', label: 'Satılık Daire s.6' },
    { url: 'https://www.sahibinden.com/satilik-mustakil-ev/konya', label: 'Müstakil Ev' },
    { url: 'https://www.sahibinden.com/satilik-mustakil-ev/konya?pagingOffset=20', label: 'Müstakil Ev s.2' },
    { url: 'https://www.sahibinden.com/satilik-arsa/konya', label: 'Satılık Arsa' },
    { url: 'https://www.sahibinden.com/satilik-arsa/konya?pagingOffset=20', label: 'Satılık Arsa s.2' },
    { url: 'https://www.sahibinden.com/satilik-arsa/konya?pagingOffset=40', label: 'Satılık Arsa s.3' },
    { url: 'https://www.sahibinden.com/satilik-villa/konya', label: 'Satılık Villa' },
    { url: 'https://www.sahibinden.com/kiralik-daire/konya', label: 'Kiralık Daire' },
    { url: 'https://www.sahibinden.com/kiralik-daire/konya?pagingOffset=20', label: 'Kiralık Daire s.2' },
    { url: 'https://www.sahibinden.com/kiralik-daire/konya?pagingOffset=40', label: 'Kiralık Daire s.3' },
    { url: 'https://www.sahibinden.com/kiralik/konya', label: 'Kiralık Genel' },
    // Selçuklu detay
    { url: 'https://www.sahibinden.com/satilik-daire/konya-selcuklu', label: 'Selçuklu Daire' },
    { url: 'https://www.sahibinden.com/satilik-daire/konya-selcuklu?pagingOffset=20', label: 'Selçuklu Daire s.2' },
    { url: 'https://www.sahibinden.com/satilik-daire/konya-selcuklu?pagingOffset=40', label: 'Selçuklu Daire s.3' },
    // Meram
    { url: 'https://www.sahibinden.com/satilik-daire/konya-meram', label: 'Meram Daire' },
    { url: 'https://www.sahibinden.com/satilik-daire/konya-meram?pagingOffset=20', label: 'Meram Daire s.2' },
    // Karatay
    { url: 'https://www.sahibinden.com/satilik-daire/konya-karatay', label: 'Karatay Daire' },
    { url: 'https://www.sahibinden.com/satilik-daire/konya-karatay?pagingOffset=20', label: 'Karatay Daire s.2' },
  ];

  for (let i = 0; i < categories.length; i++) {
    const { url: catUrl, label } = categories[i];

    // İnsan benzeri bekleme (30-90 sn)
    const waitSec = 30 + Math.random() * 60;
    console.log(`\n[${i+1}/${categories.length}] ${label} (${Math.round(waitSec)}sn bekleniyor...)`);
    await delay(waitSec * 1000, waitSec * 1000 + 5000);

    // Sayfaya git
    try {
      await page.goto(catUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    } catch {
      await page.goto(catUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    }
    await delay(3000, 6000);

    // Engel kontrolü
    const blocked = await checkBlocked(page);
    if (blocked) {
      console.log(`  ⚠ ${blocked} - 5dk bekleniyor...`);
      totalBlocked++;
      await delay(300000, 360000);
      // Tekrar dene
      try { await page.goto(catUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }); } catch {}
      await delay(5000, 8000);
      const stillBlocked = await checkBlocked(page);
      if (stillBlocked) {
        console.log(`  ⚠ Hala engelli, atlıyorum`);
        continue;
      }
    }

    // İnsan gibi scroll
    await humanScroll(page);

    // İlan linklerini topla
    const links = await getListingLinks(page);
    console.log(`  ${links.length} ilan bulundu`);

    if (links.length === 0) continue;

    // Duplicate toplu kontrol
    const existingIds = await prisma.listing.findMany({
      where: { sahibindenId: { in: links.map(l => l.id) } },
      select: { sahibindenId: true },
    });
    const existingSet = new Set(existingIds.map(e => e.sahibindenId));
    const newLinks = links.filter(l => !existingSet.has(l.id));
    totalDup += (links.length - newLinks.length);

    if (newLinks.length === 0) {
      console.log(`  Tümü zaten DB'de`);
      continue;
    }

    console.log(`  ${newLinks.length} yeni ilan, detaylar çekiliyor...`);

    // Her ilana yavaşça git
    let pageSaved = 0;
    for (const link of newLinks.slice(0, 10)) { // Max 10 ilan per kategori (engelden kaçınmak için)
      // İnsan bekleme süresi (45-120 sn)
      const ilanWait = 45 + Math.random() * 75;
      await delay(ilanWait * 1000, ilanWait * 1000 + 5000);

      try {
        await page.goto(link.href, { waitUntil: 'networkidle2', timeout: 30000 });
      } catch {
        await page.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
      }
      await delay(3000, 5000);

      const result = await scrapeDetail(page, city.id);

      if (result.status === 'saved') {
        pageSaved++;
        totalSaved++;
        const priceStr = result.price ? `${(result.price/1000000).toFixed(1)}M` : '?';
        console.log(`  ✓ ${result.title?.substring(0, 45)} | ${priceStr} TL`);
      } else if (result.status === 'agent') {
        totalAgent++;
        console.log(`  ✗ emlakçı: ${result.title?.substring(0, 40)}`);
      } else if (result.status === 'duplicate') {
        totalDup++;
      } else if (result.status === 'captcha' || result.status === 'login' || result.status === 'content-block') {
        console.log(`  ⚠ ${result.status} - 10dk bekleniyor`);
        totalBlocked++;
        await delay(600000, 660000);
        break; // Bu kategoriyi atla
      } else {
        totalError++;
      }
    }

    if (pageSaved > 0) {
      const currentCount = await prisma.listing.count();
      console.log(`  → +${pageSaved} yeni | DB: ${currentCount}`);
    }
  }

  const finalCount = await prisma.listing.count();
  console.log(`\n${"=".repeat(50)}`);
  console.log(`TAMAMLANDI!`);
  console.log(`DB: ${startCount} → ${finalCount} (+${finalCount - startCount} yeni)`);
  console.log(`Kayıt: ${totalSaved} | Emlakçı: ${totalAgent} | Dup: ${totalDup} | Engel: ${totalBlocked} | Hata: ${totalError}`);
  console.log(`Bitiş: ${new Date().toLocaleTimeString('tr-TR')}`);
  console.log(`${"=".repeat(50)}`);

  browser.disconnect();
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
