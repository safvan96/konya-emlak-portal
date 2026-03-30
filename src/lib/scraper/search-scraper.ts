/**
 * Arama motoru tabanlı scraper.
 * Sahibinden.com doğrudan erişimi engellediğinde DuckDuckGo + Jina Reader ile çalışır.
 * API key gerektirmez.
 *
 * Strateji:
 * 1. DuckDuckGo'da "site:sahibinden.com satilik konya daire" ara
 * 2. Sonuçlardan ilan URL'lerini topla
 * 3. Jina Reader (r.jina.ai) ile ilan detaylarını çek
 * 4. HTML parse et, filtrele, DB'ye kaydet
 */

import { prisma } from "../prisma";
import { filterListing } from "./filter";
import type { ScrapedListing, ScrapeResult } from "./sahibinden";

function randomDelay(min = 2000, max = 5000): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

const CATEGORIES = ["daire", "mustakil-ev", "arsa", "villa", "dukkan"];
const LISTING_TYPES_MAP: Record<string, string> = {
  satilik: "SALE",
  kiralik: "RENT",
};

async function searchDuckDuckGo(query: string): Promise<string[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const resp = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Accept-Language": "tr-TR,tr;q=0.9",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) throw new Error(`DuckDuckGo hata: ${resp.status}`);
  const html = await resp.text();

  // Sahibinden ilan URL'lerini çek (encoded ve plain)
  const urls: string[] = [];

  // URL encoded format: sahibinden.com%2Filan%2F...
  const encodedRegex = /sahibinden\.com%2Filan%2F[^"&\s]+/gi;
  let match;
  while ((match = encodedRegex.exec(html)) !== null) {
    try {
      const decoded = decodeURIComponent(match[0]);
      urls.push(`https://www.${decoded}`);
    } catch { /* skip */ }
  }

  // Plain format: sahibinden.com/ilan/...
  const plainRegex = /sahibinden\.com\/ilan\/[^"&\s<>]+/gi;
  while ((match = plainRegex.exec(html)) !== null) {
    urls.push(`https://www.${match[0]}`);
  }

  // href redirect format: uddg=https%3A%2F%2Fwww.sahibinden.com%2Filan%2F...
  const redirectRegex = /uddg=(https?%3A%2F%2F[^&]*sahibinden\.com%2Filan%2F[^&"]+)/gi;
  while ((match = redirectRegex.exec(html)) !== null) {
    try {
      urls.push(decodeURIComponent(match[1]));
    } catch { /* skip */ }
  }

  // Duplicate temizle
  return [...new Set(urls)];
}

function extractSahibindenId(url: string): string | null {
  // URL formatı: .../ilan/emlak-konut-satilik-...-1234567890
  const match = url.match(/(\d{6,})(?:\/?(?:\?|$|#)|\/?$)/);
  return match ? match[1] : null;
}

async function fetchListingViaJina(url: string): Promise<string | null> {
  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    const resp = await fetch(jinaUrl, {
      headers: {
        "Accept": "text/html",
        "X-Return-Format": "html",
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) return null;
    return resp.text();
  } catch {
    return null;
  }
}

async function fetchListingDirect(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept-Language": "tr-TR,tr;q=0.9",
        "Accept": "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) return null;
    const html = await resp.text();
    // Cloudflare challenge kontrolü
    if (html.includes("Performing security verification") || html.includes("Olağan dışı")) {
      return null;
    }
    return html;
  } catch {
    return null;
  }
}

function parseMarkdownListing(text: string, sahibindenId: string, sourceUrl: string): ScrapedListing | null {
  try {
    // Jina markdown formatını parse et
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

    // Başlık - genelde ilk anlamlı satır
    let title = "";
    for (const line of lines) {
      if (line.startsWith("# ") || line.startsWith("## ")) {
        title = line.replace(/^#+\s*/, "").trim();
        if (title.length > 10 && !title.includes("sahibinden") && !title.includes("Just a moment")) break;
      }
    }
    if (!title) {
      // Title: satırından al
      const titleMatch = text.match(/Title:\s*(.+)/i);
      title = titleMatch ? titleMatch[1].trim() : "";
    }

    // Açıklama
    let description = "";
    const descStart = text.indexOf("Açıklama");
    if (descStart > -1) {
      const descEnd = text.indexOf("\n\n", descStart + 50);
      description = text.substring(descStart, descEnd > -1 ? descEnd : descStart + 2000)
        .replace(/^Açıklama\s*/i, "").trim();
    }
    if (!description) {
      // En uzun paragrafı açıklama olarak al
      const paragraphs = text.split("\n\n").filter(p => p.length > 50);
      description = paragraphs.sort((a, b) => b.length - a.length)[0] || "";
    }

    // Fiyat
    const priceMatch = text.match(/(\d{1,3}(?:[.,]\d{3})*)\s*(?:TL|₺)/);
    let price: number | null = null;
    if (priceMatch) {
      price = parseInt(priceMatch[1].replace(/[.,]/g, ""));
    }
    const currency = text.includes("$") ? "USD" : text.includes("€") ? "EUR" : "TL";

    // Oda sayısı
    const roomMatch = text.match(/(\d\+[12])/);
    const roomCount = roomMatch ? roomMatch[1] : null;

    // m²
    const sqmMatch = text.match(/(\d+)\s*m²/i);
    const squareMeters = sqmMatch ? parseInt(sqmMatch[1]) : null;

    // Konum
    const locationMatch = text.match(/Konya[,\s]+([^,\n]+)/i);
    const district = locationMatch ? locationMatch[1].trim() : null;

    // Fotoğraflar
    const imageUrls: string[] = [];
    const imgRegex = /!\[.*?\]\((https?:\/\/[^\s)]+\.(?:jpg|jpeg|png|webp)[^\s)]*)\)/gi;
    let imgMatch;
    while ((imgMatch = imgRegex.exec(text)) !== null) {
      imageUrls.push(imgMatch[1]);
    }

    if (!title && !description) return null;

    return {
      sahibindenId,
      title: title || `Konya ${district || ""} ilan`,
      description: description.substring(0, 5000),
      price,
      currency,
      location: district ? `Konya, ${district}` : "Konya",
      district,
      neighborhood: null,
      roomCount,
      squareMeters,
      buildingAge: null,
      floor: null,
      imageUrls,
      sourceUrl,
      sellerName: null,
    };
  } catch (err) {
    console.error(`Markdown parse hata (${sahibindenId}):`, err);
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
    daire: "daire",
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

export async function scrapeViaSearch(
  citySlug: string,
  listingType: "SALE" | "RENT" = "SALE",
  maxResults: number = 20
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
    const queries = [
      `site:sahibinden.com ${typeSlug} ${city.name} daire sahibinden`,
      `site:sahibinden.com ${typeSlug} ${city.name} ev`,
      `site:sahibinden.com ${typeSlug} ${city.name} arsa`,
    ];

    const allUrls: string[] = [];

    for (const query of queries) {
      console.log(`Aranıyor: ${query}`);
      try {
        const urls = await searchDuckDuckGo(query);
        console.log(`  ${urls.length} sonuç bulundu`);
        allUrls.push(...urls);
        await randomDelay(1500, 3000);
      } catch (err) {
        console.error(`  Arama hata:`, err instanceof Error ? err.message : err);
      }
    }

    // Duplicate URL'leri temizle
    const uniqueUrls = [...new Set(allUrls)].slice(0, maxResults);
    result.totalFound = uniqueUrls.length;
    console.log(`\nToplam ${uniqueUrls.length} benzersiz ilan URL'si bulundu`);

    for (const url of uniqueUrls) {
      try {
        const sbId = extractSahibindenId(url);
        if (!sbId) {
          console.log(`  ID bulunamadı: ${url}`);
          result.errors++;
          continue;
        }

        // Duplicate kontrolü
        const existing = await prisma.listing.findUnique({
          where: { sahibindenId: sbId },
        });
        if (existing) {
          result.duplicates++;
          continue;
        }

        await randomDelay();

        // Önce Jina ile dene, başarısızsa direkt dene
        console.log(`  Çekiliyor: ${sbId}...`);
        let content = await fetchListingViaJina(url);

        if (!content || content.includes("security verification") || content.includes("403")) {
          console.log(`    Jina başarısız, direkt deneniyor...`);
          content = await fetchListingDirect(url);
        }

        if (!content) {
          console.log(`    Erişilemedi: ${url}`);
          result.errors++;
          continue;
        }

        const listing = parseMarkdownListing(content, sbId, url);
        if (!listing || !listing.title) {
          result.errors++;
          continue;
        }

        const filterResult = await filterListing(listing.description, listing.sellerName ?? undefined, listing.title);
        const categoryId = await guessCategory(listing.title);

        await prisma.listing.create({
          data: {
            sahibindenId: listing.sahibindenId,
            title: listing.title,
            description: listing.description,
            price: listing.price,
            currency: listing.currency,
            listingType,
            location: listing.location,
            district: listing.district,
            neighborhood: listing.neighborhood,
            roomCount: listing.roomCount,
            squareMeters: listing.squareMeters,
            buildingAge: listing.buildingAge,
            floor: listing.floor,
            imageUrls: listing.imageUrls,
            sourceUrl: listing.sourceUrl,
            isFromOwner: filterResult.isFromOwner,
            rejectionReason: filterResult.rejectionReason,
            status: filterResult.isFromOwner ? "ACTIVE" : "PASSIVE",
            cityId: city.id,
            categoryId,
          },
        });

        const icon = filterResult.isFromOwner ? "✓" : "✗";
        console.log(`    ${icon} ${listing.title} - ${listing.price?.toLocaleString("tr-TR") || "?"} TL`);

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
