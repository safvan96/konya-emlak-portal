/**
 * Sahibinden.com'dan Konya ilanlarını ScraperAPI ile çeker.
 *
 * Kullanım:
 *   SCRAPER_API_KEY=xxx npx tsx scripts/scrape-sahibinden.ts
 *
 * ScraperAPI ücretsiz hesap: https://dashboard.scraperapi.com/signup
 * 1000 istek/ay ücretsiz
 */

import { prisma } from "../src/lib/prisma";
import { filterListing } from "../src/lib/scraper/filter";

const API_KEY = process.env.SCRAPER_API_KEY;
if (!API_KEY) {
  console.error("SCRAPER_API_KEY env gerekli!");
  console.log("Ücretsiz key al: https://dashboard.scraperapi.com/signup");
  process.exit(1);
}

function randomDelay(min = 3000, max = 6000): Promise<void> {
  return new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));
}

async function fetchPage(url: string): Promise<string> {
  const apiUrl = `http://api.scraperapi.com?api_key=${API_KEY}&url=${encodeURIComponent(url)}&country_code=tr&render=true`;
  const resp = await fetch(apiUrl, { signal: AbortSignal.timeout(60000) });
  if (!resp.ok) throw new Error(`ScraperAPI HTTP ${resp.status}`);
  return resp.text();
}

function parseListPage(html: string): Array<{ href: string; id: string }> {
  const links: Array<{ href: string; id: string }> = [];
  const re = /href="(\/ilan\/[^"]*\/(\d+)\/[^"]*)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const href = `https://www.sahibinden.com${m[1]}`;
    if (!links.find(l => l.id === m[2])) {
      links.push({ href, id: m[2] });
    }
  }
  return links;
}

function parseDetail(html: string, id: string, url: string) {
  const titleM = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  const title = titleM ? titleM[1].replace(/<[^>]+>/g, "").trim() : "";

  const descM = html.match(/id="classifiedDescription"[^>]*>([\s\S]*?)<\/div>/);
  const description = descM ? descM[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim() : "";

  const priceM = html.match(/classifiedInfo[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/);
  const priceText = priceM ? priceM[1].replace(/<[^>]+>/g, "").trim() : "";
  const price = parseInt(priceText.replace(/[^0-9]/g, "")) || null;

  const locLinks: string[] = [];
  const locRe = /classifiedInfo[^>]*>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/;
  const locM = html.match(locRe);
  if (locM) {
    const aRe = /<a[^>]*>([^<]+)<\/a>/g;
    let am;
    while ((am = aRe.exec(locM[1])) !== null) locLinks.push(am[1].trim());
  }

  const roomM = html.match(/Oda\s*Say[ıi]s[ıi]\s*<\/strong>\s*<span[^>]*>([^<]+)/i);
  const sqmM = html.match(/m²\s*\((?:Brüt|Net)\)\s*<\/strong>\s*<span[^>]*>([^<]+)/i);
  const ageM = html.match(/Bina\s*Ya[şs][ıi]\s*<\/strong>\s*<span[^>]*>([^<]+)/i);
  const floorM = html.match(/Bulundu[ğg]u\s*Kat\s*<\/strong>\s*<span[^>]*>([^<]+)/i);

  const images: string[] = [];
  const imgRe = /data-src="(https:\/\/[^"]*sahibinden[^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/gi;
  let im;
  while ((im = imgRe.exec(html)) !== null) {
    if (!images.includes(im[1])) images.push(im[1]);
  }

  const sellerM = html.match(/username-info-area[\s\S]*?<h5[^>]*>([^<]+)/);
  const phoneM = html.match(/(\d{4}\s*\d{3}\s*\d{2}\s*\d{2})/);

  return {
    sahibindenId: id,
    title,
    description,
    price,
    currency: priceText.includes("$") ? "USD" : priceText.includes("€") ? "EUR" : "TL",
    location: locLinks.join(", ") || null,
    district: locLinks[1] || null,
    neighborhood: locLinks[2] || null,
    roomCount: roomM ? roomM[1].trim() : null,
    squareMeters: sqmM ? parseInt(sqmM[1].replace(/[^0-9]/g, "")) : null,
    buildingAge: ageM ? ageM[1].trim() : null,
    floor: floorM ? floorM[1].trim() : null,
    imageUrls: images.slice(0, 20),
    sourceUrl: url,
    sellerName: sellerM ? sellerM[1].trim() : null,
    sellerPhone: phoneM ? "0" + phoneM[1].replace(/\s/g, "") : null,
  };
}

async function main() {
  console.log("=== Sahibinden.com Konya Scraping (ScraperAPI) ===\n");

  const city = await prisma.city.findUnique({ where: { slug: "konya" } });
  if (!city) { console.error("Konya bulunamadı"); process.exit(1); }

  const urls = [
    "https://www.sahibinden.com/satilik/konya/sahibinden?pagingOffset=0",
    "https://www.sahibinden.com/satilik/konya/sahibinden?pagingOffset=20",
    "https://www.sahibinden.com/kiralik/konya/sahibinden?pagingOffset=0",
  ];

  let total = 0, accepted = 0, rejected = 0, duplicates = 0;

  for (const listUrl of urls) {
    console.log(`Liste: ${listUrl}`);
    try {
      const html = await fetchPage(listUrl);
      const links = parseListPage(html);
      console.log(`  ${links.length} ilan bulundu`);
      total += links.length;

      for (const link of links) {
        const existing = await prisma.listing.findUnique({ where: { sahibindenId: link.id } });
        if (existing) { duplicates++; continue; }

        await randomDelay();
        console.log(`  Çekiliyor: ${link.id}...`);
        const detailHtml = await fetchPage(link.href);
        const listing = parseDetail(detailHtml, link.id, link.href);

        if (!listing.title) continue;

        const filter = await filterListing(listing.description, listing.sellerName ?? undefined, listing.title);

        const categoryId = await guessCategory(listing.title);

        await prisma.listing.create({
          data: {
            ...listing,
            listingType: listUrl.includes("kiralik") ? "RENT" : "SALE",
            isFromOwner: filter.isFromOwner,
            rejectionReason: filter.rejectionReason,
            status: filter.isFromOwner ? "ACTIVE" : "PASSIVE",
            cityId: city.id,
            categoryId,
            sahibindenUrl: link.href,
          },
        });

        if (filter.isFromOwner) {
          accepted++;
          console.log(`    ✓ ${listing.title} - ${listing.price?.toLocaleString("tr-TR")} TL`);
        } else {
          rejected++;
        }
      }
      await randomDelay(5000, 8000);
    } catch (err) {
      console.error(`  Hata:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`\n=== SONUÇ ===`);
  console.log(`Toplam: ${total} | Kabul: ${accepted} | Red: ${rejected} | Dup: ${duplicates}`);
  await prisma.$disconnect();
  process.exit(0);
}

async function guessCategory(title: string): Promise<string | null> {
  const t = title.toLowerCase();
  const map: Record<string, string> = {
    villa: "villa", arsa: "arsa", tarla: "tarla", daire: "daire",
    "müstakil": "mustakil-ev", mustakil: "mustakil-ev",
    "dükkan": "dukkan", dukkan: "dukkan", ofis: "ofis",
  };
  for (const [k, v] of Object.entries(map)) {
    if (t.includes(k)) {
      const cat = await prisma.category.findUnique({ where: { slug: v } });
      return cat?.id || null;
    }
  }
  const daire = await prisma.category.findUnique({ where: { slug: "daire" } });
  return daire?.id || null;
}

main();
