/**
 * HTTP tabanlı scraper - Puppeteer yerine fetch + HTML parse kullanır.
 * ScraperAPI veya benzeri servisler üzerinden çalışır.
 * VPS/datacenter IP'lerinde Puppeteer çalışmadığında bu mod kullanılır.
 *
 * Desteklenen servisler:
 * - ScraperAPI (scraperapi.com) - SCRAPER_API_KEY env ile
 * - Zenrows (zenrows.com) - ZENROWS_API_KEY env ile
 * - Direkt proxy - PROXY_URL env ile
 */

import { prisma } from "../prisma";
import { filterListing } from "./filter";
import type { ScrapedListing, ScrapeResult } from "./sahibinden";

function randomDelay(): Promise<void> {
  const min = parseInt(process.env.SCRAPER_DELAY_MIN || "2000");
  const max = parseInt(process.env.SCRAPER_DELAY_MAX || "5000");
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

function buildUrl(targetUrl: string): string {
  const scraperApiKey = process.env.SCRAPER_API_KEY;
  const zenrowsKey = process.env.ZENROWS_API_KEY;

  if (scraperApiKey) {
    return `http://api.scraperapi.com?api_key=${scraperApiKey}&url=${encodeURIComponent(targetUrl)}&country_code=tr&render=true`;
  }
  if (zenrowsKey) {
    return `https://api.zenrows.com/v1/?apikey=${zenrowsKey}&url=${encodeURIComponent(targetUrl)}&js_render=true&premium_proxy=true`;
  }
  // Proxy kullanılıyorsa direkt URL döndür (proxy fetch'te ayarlanır)
  return targetUrl;
}

async function fetchPage(targetUrl: string): Promise<string> {
  const url = buildUrl(targetUrl);
  const proxyUrl = process.env.PROXY_URL;

  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept-Language": "tr-TR,tr;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };

  // ScraperAPI veya Zenrows kullanılıyorsa direkt fetch
  if (process.env.SCRAPER_API_KEY || process.env.ZENROWS_API_KEY) {
    const resp = await fetch(url, { headers, signal: AbortSignal.timeout(60000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    return resp.text();
  }

  // Proxy ile fetch - proxy URL'yi ScraperAPI formatına çevir
  if (proxyUrl) {
    // Proxy'yi ScraperAPI benzeri şekilde kullan
    const resp = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(60000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    return resp.text();
  }

  // Direkt fetch (ev IP'sinden çalışırken)
  const resp = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
  return resp.text();
}

function parseListingLinks(html: string): Array<{ href: string; id: string }> {
  const links: Array<{ href: string; id: string }> = [];
  // searchResultsItem içindeki classifiedTitle linklerini bul
  const linkRegex = /<a[^>]*class="[^"]*classifiedTitle[^"]*"[^>]*href="([^"]+)"[^>]*>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1].startsWith("http") ? match[1] : `https://www.sahibinden.com${match[1]}`;
    const idMatch = href.match(/\/(\d+)\//);
    if (idMatch) {
      links.push({ href, id: idMatch[1] });
    }
  }
  return links;
}

function parseListingDetail(html: string, sahibindenId: string, sourceUrl: string): ScrapedListing | null {
  try {
    // Başlık
    const titleMatch = html.match(/<h1[^>]*class="[^"]*classifiedDetailTitle[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)
      || html.match(/<div[^>]*class="[^"]*classifiedDetailTitle[^"]*"[^>]*>[\s\S]*?<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";

    // Açıklama
    const descMatch = html.match(/<div[^>]*id="classifiedDescription"[^>]*>([\s\S]*?)<\/div>/i);
    const description = descMatch ? descMatch[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim() : "";

    // Fiyat
    const priceMatch = html.match(/<div[^>]*class="[^"]*classifiedInfo[^"]*"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/i);
    const priceText = priceMatch ? priceMatch[1].replace(/<[^>]+>/g, "").trim() : "";
    const priceNum = priceText.replace(/[^0-9]/g, "");
    const price = priceNum ? parseInt(priceNum) : null;
    const currency = priceText.includes("$") ? "USD" : priceText.includes("€") ? "EUR" : "TL";

    // Konum
    const locationMatch = html.match(/<div[^>]*class="[^"]*classifiedInfo[^"]*"[^>]*>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/i);
    const locationHtml = locationMatch ? locationMatch[1] : "";
    const locationParts: string[] = [];
    const locLinkRegex = /<a[^>]*>([\s\S]*?)<\/a>/gi;
    let locMatch;
    while ((locMatch = locLinkRegex.exec(locationHtml)) !== null) {
      const part = locMatch[1].replace(/<[^>]+>/g, "").trim();
      if (part) locationParts.push(part);
    }

    // Detay bilgileri
    const info: Record<string, string> = {};
    const infoRegex = /<li[^>]*>[\s\S]*?<strong[^>]*>([\s\S]*?)<\/strong>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>[\s\S]*?<\/li>/gi;
    let infoMatch;
    while ((infoMatch = infoRegex.exec(html)) !== null) {
      const label = infoMatch[1].replace(/<[^>]+>/g, "").trim();
      const value = infoMatch[2].replace(/<[^>]+>/g, "").trim();
      if (label && value) info[label] = value;
    }

    // Fotoğraflar
    const imageUrls: string[] = [];
    const imgRegex = /<img[^>]*class="[^"]*classifiedDetailPhoto[^"]*"[^>]*src="([^"]+)"/gi;
    let imgMatch;
    while ((imgMatch = imgRegex.exec(html)) !== null) {
      if (!imgMatch[1].includes("placeholder")) imageUrls.push(imgMatch[1]);
    }
    // data-src'den de dene (lazy load)
    const lazyImgRegex = /data-src="(https:\/\/[^"]*sahibinden[^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/gi;
    while ((imgMatch = lazyImgRegex.exec(html)) !== null) {
      if (!imageUrls.includes(imgMatch[1])) imageUrls.push(imgMatch[1]);
    }

    // Satıcı adı
    const sellerMatch = html.match(/<div[^>]*class="[^"]*username-info-area[^"]*"[^>]*>[\s\S]*?<h5[^>]*>([\s\S]*?)<\/h5>/i);
    const sellerName = sellerMatch ? sellerMatch[1].replace(/<[^>]+>/g, "").trim() : null;

    const sqmBrut = info["m² (Brüt)"] ? parseInt(info["m² (Brüt)"].replace(/[^0-9]/g, "")) : null;
    const sqmNet = info["m² (Net)"] ? parseInt(info["m² (Net)"].replace(/[^0-9]/g, "")) : null;

    return {
      sahibindenId,
      title,
      description,
      price,
      currency,
      location: locationParts.join(", ") || null,
      district: locationParts[1] || null,
      neighborhood: locationParts[2] || null,
      roomCount: info["Oda Sayısı"] || null,
      squareMeters: sqmBrut || sqmNet || null,
      buildingAge: info["Bina Yaşı"] || null,
      floor: info["Bulunduğu Kat"] || null,
      imageUrls,
      sourceUrl,
      sellerName,
    };
  } catch (err) {
    console.error(`Parse hatası (${sahibindenId}):`, err);
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

export async function scrapeWithHttp(
  citySlug: string,
  listingType: "SALE" | "RENT" = "SALE",
  maxPages: number = 3
): Promise<ScrapeResult> {
  const startTime = Date.now();
  const result: ScrapeResult = {
    totalFound: 0, accepted: 0, rejected: 0,
    duplicates: 0, errors: 0, duration: 0,
  };

  const mode = process.env.SCRAPER_API_KEY ? "ScraperAPI" :
    process.env.ZENROWS_API_KEY ? "Zenrows" :
    process.env.PROXY_URL ? "Proxy" : "Direkt";
  console.log(`HTTP Scraper modu: ${mode}`);

  const city = await prisma.city.findUnique({ where: { slug: citySlug } });
  if (!city) throw new Error(`Şehir bulunamadı: ${citySlug}`);

  const scraperRun = await prisma.scraperRun.create({
    data: { cityId: city.id, status: "running" },
  });

  try {
    const typeSlug = listingType === "SALE" ? "satilik" : "kiralik";
    const baseUrl = `https://www.sahibinden.com/${typeSlug}-${city.slug}`;

    for (let pageNum = 0; pageNum < maxPages; pageNum++) {
      try {
        const offset = pageNum * 20;
        const url = pageNum === 0 ? baseUrl : `${baseUrl}?pagingOffset=${offset}`;

        console.log(`Sayfa taraniyor: ${url}`);
        const html = await fetchPage(url);

        // Engel kontrolü
        if (html.includes("Olağan dışı erişim") || html.includes("checkLoading")) {
          throw new Error("Sahibinden bot tespiti - ScraperAPI key veya residential proxy gerekli.");
        }
        if (html.includes("sahibinden.com Giriş") && html.includes("giris")) {
          throw new Error("Sahibinden login redirect - erişim engellendi.");
        }

        const listingLinks = parseListingLinks(html);
        result.totalFound += listingLinks.length;

        if (listingLinks.length === 0) {
          console.log("Bu sayfada ilan bulunamadı, durduruluyor.");
          break;
        }

        console.log(`${listingLinks.length} ilan bulundu, detaylar çekiliyor...`);

        for (const link of listingLinks) {
          try {
            const existing = await prisma.listing.findUnique({
              where: { sahibindenId: link.id },
            });

            if (existing) {
              // Fiyat güncelleme
              await randomDelay();
              const detailHtml = await fetchPage(link.href);
              const freshData = parseListingDetail(detailHtml, link.id, link.href);
              if (freshData?.price && existing.price && freshData.price !== existing.price) {
                await prisma.priceHistory.create({
                  data: { listingId: existing.id, oldPrice: existing.price, newPrice: freshData.price },
                });
                await prisma.listing.update({
                  where: { id: existing.id },
                  data: { price: freshData.price },
                });
                console.log(`Fiyat güncellendi: ${existing.title} ${existing.price} -> ${freshData.price}`);
              }
              result.duplicates++;
              continue;
            }

            await randomDelay();
            const detailHtml = await fetchPage(link.href);
            const listing = parseListingDetail(detailHtml, link.id, link.href);

            if (!listing || !listing.title) {
              result.errors++;
              continue;
            }

            const filterResult = await filterListing(listing.description, listing.sellerName ?? undefined, listing.title);

            // Benzer ilan tespiti
            if (listing.title && listing.price) {
              const similar = await prisma.listing.findFirst({
                where: {
                  title: listing.title, price: listing.price,
                  cityId: city.id, sahibindenId: { not: listing.sahibindenId },
                },
              });
              if (similar) {
                console.log(`Benzer ilan atlandı: ${listing.title}`);
                result.duplicates++;
                continue;
              }
            }

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

            const status = filterResult.isFromOwner ? "✓" : "✗";
            console.log(`  ${status} ${listing.title} - ${listing.price?.toLocaleString("tr-TR")} TL`);

            if (filterResult.isFromOwner) result.accepted++;
            else result.rejected++;
          } catch (err) {
            console.error(`İlan hata: ${link.id}`, err instanceof Error ? err.message : err);
            result.errors++;
          }
        }

        await randomDelay();
      } catch (err) {
        console.error(`Sayfa hata: ${pageNum}`, err instanceof Error ? err.message : err);
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
        completedAt: new Date(),
        duration: Date.now() - startTime,
      },
    });
    throw err;
  }
}
