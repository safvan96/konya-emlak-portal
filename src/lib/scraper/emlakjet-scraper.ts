/**
 * Emlakjet.com scraper - VPS'den direkt erişilebilir, API key gerektirmez.
 * Sahibinden.com erişilemediğinde alternatif kaynak olarak kullanılır.
 *
 * Emlakjet sahibinden kadar büyük değil ama Konya'da yeterli ilan var
 * ve Cloudflare koruması sahibinden kadar agresif değil.
 */

import { prisma } from "../prisma";
import { filterListing } from "./filter";
import type { ScrapeResult } from "./sahibinden";

function randomDelay(min = 2000, max = 5000): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

interface EmlakjetListing {
  emlakjetId: string;
  url: string;
  title: string;
  description: string;
  price: number | null;
  currency: string;
  city: string;
  district: string | null;
  neighborhood: string | null;
  roomCount: string | null;
  squareMeters: number | null;
  buildingAge: string | null;
  floor: string | null;
  imageUrls: string[];
  sellerName: string | null;
}

function parseListPage(html: string): string[] {
  const urls: string[] = [];
  const re = /href="(\/ilan\/[^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (!urls.includes(m[1])) urls.push(m[1]);
  }
  return urls;
}

function parseDetailPage(html: string, url: string): EmlakjetListing | null {
  try {
    // ID çıkar - URL'nin sonundaki sayı
    const idMatch = url.match(/(\d+)(?:\/?$)/);
    if (!idMatch) return null;
    const emlakjetId = `EJ${idMatch[1]}`;

    // JSON key-value çiftlerini çıkar
    const fields: Record<string, string> = {};
    const re = /"(\w+)"\s*:\s*"([^"]{1,1000})"/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      if (!fields[m[1]]) fields[m[1]] = m[2];
    }

    // Başlık - title tag'inden
    const titleMatch = html.match(/<title>([^<]+)/);
    let title = titleMatch ? titleMatch[1].replace(/\s*\|.*$/, "").replace(/\s*#\d+$/, "").trim() : "";
    // Emlakjet prefix'ini kaldır
    title = title.replace(/^Emlakjet\s*-?\s*/i, "").trim();
    // Başlığı temizle: satıcı adı + fiyat kaldır
    title = title.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    title = title.replace(/\s+[\d,.]+\s*TL\s*$/i, ""); // Sondaki fiyat
    const cityNames = ["Konya", "Ankara", "İstanbul", "İzmir", "Bursa", "Antalya", "Adana", "Gaziantep", "Kayseri", "Mersin"];
    for (const cn of cityNames) {
      const idx = title.indexOf(cn);
      if (idx > 0) { title = title.substring(idx); break; }
    }
    for (const cn of cityNames) {
      title = title.replace(new RegExp(`^${cn}\\s+`), "");
    }
    title = title.replace(/\s+Oda\s+/g, " ");
    title = title.replace(/Mahallesi/g, "Mah.");
    title = title.replace(/\s+/g, " ").trim();

    // Açıklama
    const description = fields.description || "";

    // Fiyat
    const price = fields.price ? parseInt(fields.price.replace(/[^0-9]/g, "")) : null;
    const currency = fields.priceCurrency === "USD" ? "USD" : fields.priceCurrency === "EUR" ? "EUR" : "TL";

    // Konum
    const city = fields.city || "";
    const district = fields.district ? fields.district.replace(/-/g, " ") : null;
    const neighborhood = fields.neighborhood ? fields.neighborhood.replace(/-/g, " ") : null;

    // Oda sayısı - başlık veya açıklamadan
    const roomMatch = (title + " " + description).match(/(\d\+[12])/);
    const roomCount = roomMatch ? roomMatch[1] : null;

    // m² - açıklamadan
    const sqmMatch = (title + " " + description).match(/(\d+)\s*m²/i);
    const squareMeters = sqmMatch ? parseInt(sqmMatch[1]) : null;

    // Fotoğraflar
    const imageUrls: string[] = [];
    const imgRe = /https:\/\/imaj\.emlakjet\.com\/listing\/[^"'\s<>]+/g;
    while ((m = imgRe.exec(html)) !== null) {
      if (!imageUrls.includes(m[0])) imageUrls.push(m[0]);
    }

    // Satıcı adı - açıklamadan çıkar
    let sellerName: string | null = null;
    const sellerMatch = description.match(/^([^,]+?)(?:\s+\d|\s+konumunda)/);
    if (sellerMatch && sellerMatch[1].length < 50) {
      sellerName = sellerMatch[1].trim();
    }

    if (!title && !description) return null;

    return {
      emlakjetId,
      url: `https://www.emlakjet.com${url}`,
      title,
      description: description.substring(0, 5000),
      price,
      currency,
      city,
      district,
      neighborhood,
      roomCount,
      squareMeters,
      buildingAge: null,
      floor: null,
      imageUrls: imageUrls.slice(0, 20),
      sellerName,
    };
  } catch (err) {
    console.error(`Parse hata:`, err instanceof Error ? err.message : err);
    return null;
  }
}

async function guessCategory(title: string): Promise<string | null> {
  const lowerTitle = title.toLowerCase();
  const categoryMap: Record<string, string> = {
    villa: "villa", arsa: "arsa", tarla: "tarla",
    "dükkan": "dukkan", dukkan: "dukkan", ofis: "ofis",
    depo: "depo", bina: "bina", "müstakil": "mustakil-ev",
    mustakil: "mustakil-ev", residans: "residans",
    "devremülk": "devremulk", devremulk: "devremulk",
    kooperatif: "kooperatif", daire: "daire",
    dubleks: "daire", dublex: "daire",
  };

  for (const [keyword, slug] of Object.entries(categoryMap)) {
    if (lowerTitle.includes(keyword)) {
      const category = await prisma.category.findUnique({ where: { slug } });
      return category?.id || null;
    }
  }
  const daire = await prisma.category.findUnique({ where: { slug: "daire" } });
  return daire?.id || null;
}

export async function scrapeEmlakjet(
  citySlug: string,
  listingType: "SALE" | "RENT" = "SALE",
  maxPages: number = 3
): Promise<ScrapeResult> {
  const startTime = Date.now();
  const result: ScrapeResult = {
    totalFound: 0, accepted: 0, rejected: 0,
    duplicates: 0, errors: 0, duration: 0,
  };

  const city = await prisma.city.findUnique({ where: { slug: citySlug } });
  if (!city) throw new Error(`Şehir bulunamadı: ${citySlug}`);

  const scraperRun = await prisma.scraperRun.create({
    data: { cityId: city.id, status: "running" },
  });

  try {
    const typeSlug = listingType === "SALE" ? "satilik" : "kiralik";
    // Emlakjet URL: /satilik-daire/konya, /satilik-arsa/konya vb.
    const propertyTypes = [
      "konut", "daire", "mustakil-ev", "arsa", "villa",
      "kooperatif", "ofis", "bina", "ciftlik-evi", "depo",
    ];
    const allListingUrls: string[] = [];

    for (const propType of propertyTypes) {
      const baseUrl = `https://www.emlakjet.com/${typeSlug}-${propType}/${city.slug}`;

      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        try {
          const url = pageNum === 1 ? baseUrl : `${baseUrl}?page=${pageNum}`;
          console.log(`Liste sayfası: ${url}`);

        const resp = await fetch(url, {
          headers: HEADERS,
          signal: AbortSignal.timeout(20000),
        });

        if (!resp.ok) {
          console.error(`  HTTP ${resp.status} - sayfa atlanıyor`);
          if (resp.status === 403) {
            console.error("  Emlakjet erişim engeli! Rate limiting gerekebilir.");
            break;
          }
          continue;
        }

        const html = await resp.text();

        // Erişim kontrolü
        if (html.includes("security verification") || html.includes("captcha")) {
          console.error("  Emlakjet bot tespiti - durduruluyor");
          break;
        }

        const urls = parseListPage(html);
        console.log(`  ${urls.length} ilan bulundu`);
        allListingUrls.push(...urls);

        if (urls.length === 0) break;
        await randomDelay(1500, 3000);
      } catch (err) {
        console.error(`  Sayfa hata:`, err instanceof Error ? err.message : err);
        result.errors++;
      }
      }
    }

    // Unique URLs
    const uniqueUrls = [...new Set(allListingUrls)];
    result.totalFound = uniqueUrls.length;
    console.log(`\nToplam ${uniqueUrls.length} benzersiz ilan, detaylar çekiliyor...\n`);

    for (const listingUrl of uniqueUrls) {
      try {
        // ID çıkar
        const idMatch = listingUrl.match(/(\d+)(?:\/?$)/);
        if (!idMatch) { result.errors++; continue; }
        const emlakjetId = `EJ${idMatch[1]}`;

        // Duplicate kontrolü
        const existing = await prisma.listing.findUnique({
          where: { sahibindenId: emlakjetId },
        });
        if (existing) {
          result.duplicates++;
          continue;
        }

        await randomDelay();

        const resp = await fetch(`https://www.emlakjet.com${listingUrl}`, {
          headers: HEADERS,
          signal: AbortSignal.timeout(20000),
        });

        if (!resp.ok) {
          console.log(`  HTTP ${resp.status}: ${listingUrl}`);
          result.errors++;
          continue;
        }

        const html = await resp.text();
        const listing = parseDetailPage(html, listingUrl);

        if (!listing || !listing.title) {
          result.errors++;
          continue;
        }

        // Emlakçı filtresi (title da taranır - Emlakjet'de satıcı adı başlıkta)
        const filterResult = await filterListing(
          listing.description,
          listing.sellerName ?? undefined,
          listing.title
        );

        // Benzer ilan tespiti
        if (listing.title && listing.price) {
          const similar = await prisma.listing.findFirst({
            where: {
              title: listing.title,
              price: listing.price,
              cityId: city.id,
            },
          });
          if (similar) {
            result.duplicates++;
            continue;
          }
        }

        const categoryId = await guessCategory(listing.title);

        await prisma.listing.create({
          data: {
            sahibindenId: emlakjetId, // sahibindenId alanını kaynak ID olarak kullanıyoruz
            title: listing.title,
            description: listing.description,
            price: listing.price,
            currency: listing.currency,
            listingType,
            location: [city.name, listing.district, listing.neighborhood].filter(Boolean).join(", "),
            district: listing.district,
            neighborhood: listing.neighborhood,
            roomCount: listing.roomCount,
            squareMeters: listing.squareMeters,
            buildingAge: listing.buildingAge,
            floor: listing.floor,
            imageUrls: listing.imageUrls,
            sourceUrl: listing.url,
            isFromOwner: filterResult.isFromOwner,
            rejectionReason: filterResult.rejectionReason,
            status: filterResult.isFromOwner ? "ACTIVE" : "PASSIVE",
            cityId: city.id,
            categoryId,
          },
        });

        const icon = filterResult.isFromOwner ? "✓" : "✗";
        console.log(`  ${icon} ${listing.title.substring(0, 60)} - ${listing.price?.toLocaleString("tr-TR") || "?"} TL`);

        if (filterResult.isFromOwner) result.accepted++;
        else result.rejected++;
      } catch (err) {
        console.error(`  Hata:`, err instanceof Error ? err.message : err);
        result.errors++;
      }
    }

    result.duration = Date.now() - startTime;
    await prisma.scraperRun.update({
      where: { id: scraperRun.id },
      data: {
        totalFound: result.totalFound, accepted: result.accepted,
        rejected: result.rejected, duplicates: result.duplicates,
        errors: result.errors, duration: result.duration,
        status: "completed", completedAt: new Date(),
      },
    });

    return result;
  } catch (err) {
    await prisma.scraperRun.update({
      where: { id: scraperRun.id },
      data: {
        status: "failed",
        errorMessage: err instanceof Error ? err.message : "Bilinmeyen hata",
        completedAt: new Date(), duration: Date.now() - startTime,
      },
    });
    throw err;
  }
}
