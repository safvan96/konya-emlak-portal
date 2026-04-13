/**
 * Emlakjet Deep Scraper - Mevcut scraper'ı daha fazla sayfa ile çalıştırır
 * HTTP fetch ile çalışır, Chrome'a gerek yok
 */

// Prisma client'ı import et
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
  "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

function delay(min, max) {
  const ms = min + Math.random() * (max - min);
  return new Promise(r => setTimeout(r, ms));
}

function normalize(t) {
  const m = {"ç":"c","ğ":"g","ı":"i","ö":"o","ş":"s","ü":"u","Ç":"c","Ğ":"g","İ":"i","Ö":"o","Ş":"s","Ü":"u"};
  return t.replace(/[^\x00-\x7F]/g, c => m[c] || "").toLowerCase();
}

const AGENT_WORDS = ["emlak","gayrimenkul","remax","century","coldwell","turyap","danışman","broker","ofisimiz","portföy","franchise","keller williams","danismanlik"];
function isAgent(text) { return AGENT_WORDS.some(w => normalize(text).includes(normalize(w))); }

function parseListPage(html) {
  const urls = [];
  const re = /href="(\/ilan\/[^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (!urls.includes(m[1])) urls.push(m[1]);
  }
  return urls;
}

function parseDetailPage(html, url) {
  try {
    const idMatch = url.match(/(\d+)(?:\/?$)/);
    if (!idMatch) return null;
    const emlakjetId = `EJ${idMatch[1]}`;

    const fields = {};
    const re = /"(\w+)"\s*:\s*"([^"]{1,1000})"/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      if (!fields[m[1]]) fields[m[1]] = m[2];
    }

    const titleMatch = html.match(/<title>([^<]+)/);
    const originalTitle = titleMatch ? titleMatch[1].replace(/\s*\|.*$/, "").replace(/\s*#\d+$/, "").replace(/^Emlakjet\s*-?\s*/i, "").trim() : "";

    let title = originalTitle.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    title = title.replace(/\s+[\d,.]+\s*TL\s*$/i, "");
    const cityNames = ["Konya", "Ankara", "İstanbul", "İzmir"];
    for (const cn of cityNames) {
      const idx = title.indexOf(cn);
      if (idx > 0) { title = title.substring(idx); break; }
    }
    for (const cn of cityNames) {
      title = title.replace(new RegExp(`^${cn}\\s+`), "");
    }
    title = title.replace(/Mahallesi/g, "Mah.").replace(/\s+/g, " ").trim();

    const description = fields.description || "";
    const price = fields.price ? parseInt(fields.price.replace(/[^0-9]/g, "")) : null;
    const currency = fields.priceCurrency === "USD" ? "USD" : fields.priceCurrency === "EUR" ? "EUR" : "TL";
    const city = fields.city || "";
    const district = fields.district ? fields.district.replace(/-/g, " ") : null;
    const neighborhood = fields.neighborhood ? fields.neighborhood.replace(/-/g, " ") : null;

    const roomMatch = (title + " " + description).match(/(\d\+[12])/);
    const sqmMatch = (title + " " + description).match(/(\d+)\s*m²/i);

    const imageUrls = [];
    const imgRe = /https:\/\/imaj\.emlakjet\.com\/listing\/[^"'\s<>]+/g;
    while ((m = imgRe.exec(html)) !== null) {
      if (!imageUrls.includes(m[0])) imageUrls.push(m[0]);
    }

    let sellerPhone = null;
    const phoneMatch = html.match(/"telephone"\s*:\s*"(\d{10,11})"/);
    if (phoneMatch) {
      sellerPhone = phoneMatch[1];
      if (sellerPhone.length === 10 && !sellerPhone.startsWith("0")) sellerPhone = "0" + sellerPhone;
    }

    return {
      emlakjetId, title, originalTitle, description: description.substring(0, 5000),
      price, currency, city, district, neighborhood,
      roomCount: roomMatch ? roomMatch[1] : null,
      squareMeters: sqmMatch ? parseInt(sqmMatch[1]) : null,
      imageUrls: imageUrls.slice(0, 20),
      sellerName: "Sahibinden", sellerPhone,
      url: `https://www.emlakjet.com${url}`,
    };
  } catch { return null; }
}

let catCache = {};
async function guessCategory(title) {
  const lower = title.toLowerCase();
  const map = { villa: "villa", arsa: "arsa", tarla: "arsa", "müstakil": "mustakil-ev", mustakil: "mustakil-ev" };
  for (const [kw, slug] of Object.entries(map)) {
    if (lower.includes(kw)) {
      if (!catCache[slug]) catCache[slug] = await prisma.category.findUnique({ where: { slug } });
      return catCache[slug]?.id || null;
    }
  }
  if (!catCache["daire"]) catCache["daire"] = await prisma.category.findUnique({ where: { slug: "daire" } });
  return catCache["daire"]?.id || null;
}

async function main() {
  console.log("=== Emlakjet Deep Scraper ===");
  console.log(`Başlangıç: ${new Date().toLocaleTimeString('tr-TR')}\n`);

  const city = await prisma.city.findUnique({ where: { slug: "konya" } });
  if (!city) { console.error("Konya yok!"); process.exit(1); }

  const startCount = await prisma.listing.count();
  let totalAccepted = 0, totalRejected = 0, totalDuplicates = 0, totalErrors = 0;

  // Tüm kategori ve tip kombinasyonları
  const propertyTypes = [
    "konut", "daire", "mustakil-ev", "arsa", "villa",
    "kooperatif", "ofis", "bina", "ciftlik-evi", "depo",
    "residans", "yazlik", "prefabrik-ev",
  ];

  const configs = [];
  for (const propType of propertyTypes) {
    // Satılık - sahibinden (gerçek sahipten)
    for (let p = 1; p <= 20; p++) {
      configs.push({ type: "SALE", propType, page: p, owner: true });
    }
    // Kiralık - sahibinden
    for (let p = 1; p <= 10; p++) {
      configs.push({ type: "RENT", propType, page: p, owner: true });
    }
  }

  console.log(`Toplam ${configs.length} sayfa taranacak\n`);

  let emptyCount = 0;
  let lastPropType = '';

  for (let i = 0; i < configs.length; i++) {
    const { type, propType, page, owner } = configs[i];

    // Yeni kategori başlangıcı
    if (propType !== lastPropType) {
      emptyCount = 0;
      lastPropType = propType;
    }

    // 3 ardışık boş sayfa → bu kategoriyi atla
    if (emptyCount >= 3) {
      const nextDiff = configs.findIndex((c, j) => j > i && c.propType !== propType);
      if (nextDiff > 0) { i = nextDiff - 1; emptyCount = 0; continue; }
      break;
    }

    const typeSlug = type === "SALE" ? "satilik" : "kiralik";
    const ownerSuffix = owner ? "/sahibinden" : "";
    const baseUrl = `https://www.emlakjet.com/${typeSlug}-${propType}/konya${ownerSuffix}`;
    const url = page === 1 ? baseUrl : `${baseUrl}?page=${page}`;

    try {
      await delay(1500, 3000);
      const resp = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20000) });

      if (!resp.ok) {
        if (resp.status === 403) {
          console.log(`  ⚠ 403 engel - 30sn bekleniyor`);
          await delay(30000, 45000);
        }
        emptyCount++;
        continue;
      }

      const html = await resp.text();
      if (html.includes("security verification") || html.includes("captcha")) {
        console.log("  ⚠ Bot tespiti - 60sn bekleniyor");
        await delay(60000, 90000);
        continue;
      }

      const listUrls = parseListPage(html);
      if (listUrls.length === 0) { emptyCount++; continue; }
      emptyCount = 0;

      // Duplicate toplu kontrol
      const ids = listUrls.map(u => { const m = u.match(/(\d+)(?:\/?$)/); return m ? `EJ${m[1]}` : null; }).filter(Boolean);
      const existing = await prisma.listing.findMany({
        where: { sahibindenId: { in: ids } },
        select: { sahibindenId: true },
      });
      const existingSet = new Set(existing.map(e => e.sahibindenId));
      const newUrls = listUrls.filter(u => { const m = u.match(/(\d+)(?:\/?$)/); return m && !existingSet.has(`EJ${m[1]}`); });

      totalDuplicates += (listUrls.length - newUrls.length);

      if (newUrls.length === 0) {
        process.stdout.write(`[${i+1}/${configs.length}] ${typeSlug}-${propType} s.${page}: ${listUrls.length} ilan (tümü dup)\n`);
        continue;
      }

      process.stdout.write(`[${i+1}/${configs.length}] ${typeSlug}-${propType} s.${page}: ${listUrls.length} ilan (${newUrls.length} yeni) `);

      let pageAccepted = 0;

      for (const listingUrl of newUrls) {
        try {
          await delay(1500, 3000);
          const detailResp = await fetch(`https://www.emlakjet.com${listingUrl}`, {
            headers: HEADERS, signal: AbortSignal.timeout(20000)
          });

          if (!detailResp.ok) { totalErrors++; continue; }

          const detailHtml = await detailResp.text();
          const listing = parseDetailPage(detailHtml, listingUrl);
          if (!listing || !listing.title) { totalErrors++; continue; }

          // Emlakçı filtresi
          const fullText = listing.title + ' ' + listing.description + ' ' + (listing.originalTitle || '');
          if (isAgent(fullText)) { totalRejected++; continue; }

          // Benzer ilan kontrolü
          if (listing.title && listing.price) {
            const similar = await prisma.listing.findFirst({
              where: { title: listing.title, price: listing.price, cityId: city.id },
            });
            if (similar) { totalDuplicates++; continue; }
          }

          const categoryId = await guessCategory(listing.title);

          await prisma.listing.create({
            data: {
              sahibindenId: listing.emlakjetId,
              title: listing.title,
              description: listing.description,
              price: listing.price,
              currency: listing.currency,
              listingType: type,
              location: ["Konya", listing.district, listing.neighborhood].filter(Boolean).join(", "),
              district: listing.district,
              neighborhood: listing.neighborhood,
              roomCount: listing.roomCount,
              squareMeters: listing.squareMeters,
              imageUrls: listing.imageUrls,
              sourceUrl: listing.url,
              sellerName: listing.sellerName,
              sellerPhone: listing.sellerPhone,
              isFromOwner: true,
              status: 'ACTIVE',
              cityId: city.id,
              categoryId,
            },
          });

          pageAccepted++;
          totalAccepted++;
          process.stdout.write('.');

        } catch { totalErrors++; }
      }

      console.log(` +${pageAccepted}`);

    } catch (err) {
      totalErrors++;
    }

    // Her 20 sayfada özet
    if ((i + 1) % 20 === 0) {
      const currentCount = await prisma.listing.count();
      console.log(`\n--- ÖZET [${i+1}/${configs.length}] ---`);
      console.log(`DB: ${currentCount} (+${currentCount - startCount} yeni)`);
      console.log(`Kabul: ${totalAccepted} | Red: ${totalRejected} | Dup: ${totalDuplicates} | Hata: ${totalErrors}`);
      console.log(`Saat: ${new Date().toLocaleTimeString('tr-TR')}\n`);
    }
  }

  const finalCount = await prisma.listing.count();
  console.log(`\n${"=".repeat(50)}`);
  console.log(`TAMAMLANDI!`);
  console.log(`DB: ${startCount} → ${finalCount} (+${finalCount - startCount} yeni ilan)`);
  console.log(`Kabul: ${totalAccepted} | Red: ${totalRejected} | Dup: ${totalDuplicates} | Hata: ${totalErrors}`);
  console.log(`Bitiş: ${new Date().toLocaleTimeString('tr-TR')}`);
  console.log(`${"=".repeat(50)}`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
