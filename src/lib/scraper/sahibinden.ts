import puppeteer, { type Browser, type Page } from "puppeteer";
import { prisma } from "../prisma";
import { filterListing } from "./filter";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

function randomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomDelay(): Promise<void> {
  const min = parseInt(process.env.SCRAPER_DELAY_MIN || "2000");
  const max = parseInt(process.env.SCRAPER_DELAY_MAX || "5000");
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

export interface ScrapedListing {
  sahibindenId: string;
  title: string;
  description: string;
  price: number | null;
  currency: string;
  location: string | null;
  district: string | null;
  neighborhood: string | null;
  roomCount: string | null;
  squareMeters: number | null;
  buildingAge: string | null;
  floor: string | null;
  imageUrls: string[];
  sourceUrl: string;
  sellerName: string | null;
}

export interface ScrapeResult {
  totalFound: number;
  accepted: number;
  rejected: number;
  duplicates: number;
  errors: number;
  duration: number;
}

export async function scrapeSahibinden(
  citySlug: string,
  listingType: "SALE" | "RENT" = "SALE",
  maxPages: number = 3
): Promise<ScrapeResult> {
  const startTime = Date.now();
  const result: ScrapeResult = {
    totalFound: 0,
    accepted: 0,
    rejected: 0,
    duplicates: 0,
    errors: 0,
    duration: 0,
  };

  // Şehir bilgisini al
  const city = await prisma.city.findUnique({
    where: { slug: citySlug },
  });

  if (!city) {
    throw new Error(`Şehir bulunamadı: ${citySlug}`);
  }

  // Scraper run kaydı oluştur
  const scraperRun = await prisma.scraperRun.create({
    data: {
      cityId: city.id,
      status: "running",
    },
  });

  let browser: Browser | null = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    const page = await browser.newPage();
    await page.setUserAgent(randomUserAgent());
    await page.setViewport({ width: 1366, height: 768 });

    // Cookie consent ve popup'lari otomatik kapat
    page.on("dialog", async (dialog) => { await dialog.dismiss(); });
    await page.evaluateOnNewDocument(() => {
      // Cookie consent banner'i gizle
      const style = document.createElement("style");
      style.textContent = "#onetrust-consent-sdk, .cookie-consent, [class*='cookie'], [id*='cookie'] { display: none !important; }";
      document.head.appendChild(style);
    });

    // sahibinden.com ilan listesi URL'si - şehir slug'ı dinamik
    const typeSlug = listingType === "SALE" ? "satilik" : "kiralik";
    const baseUrl = `https://www.sahibinden.com/${typeSlug}-${city.slug}`;

    for (let pageNum = 0; pageNum < maxPages; pageNum++) {
      try {
        const offset = pageNum * 20;
        const url =
          pageNum === 0 ? baseUrl : `${baseUrl}?pagingOffset=${offset}`;

        console.log(`Sayfa taraniyor: ${url}`);
        await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
        await randomDelay();

        // İlan linklerini topla
        const listingLinks = await page.evaluate(() => {
          const rows = document.querySelectorAll(
            ".searchResultsItem a.classifiedTitle"
          );
          return Array.from(rows)
            .map((a) => ({
              href: (a as HTMLAnchorElement).href,
              id: (a as HTMLAnchorElement).href.match(/\/(\d+)\//)?.[1] || "",
            }))
            .filter((l) => l.id);
        });

        result.totalFound += listingLinks.length;

        if (listingLinks.length === 0) {
          console.log("Bu sayfada ilan bulunamadı, durduruluyor.");
          break;
        }

        // Her ilanın detayına gir
        for (const link of listingLinks) {
          try {
            // Duplicate kontrolü
            const existing = await prisma.listing.findUnique({
              where: { sahibindenId: link.id },
            });

            if (existing) {
              // Mevcut ilan - fiyat degisimi kontrol et
              await randomDelay();
              const freshData = await scrapeListingDetail(page, link.href, link.id);
              if (freshData?.price && existing.price && freshData.price !== existing.price) {
                await prisma.priceHistory.create({
                  data: {
                    listingId: existing.id,
                    oldPrice: existing.price,
                    newPrice: freshData.price,
                  },
                });
                await prisma.listing.update({
                  where: { id: existing.id },
                  data: { price: freshData.price },
                });
                console.log(`Fiyat guncellendi: ${existing.title} ${existing.price} -> ${freshData.price}`);
              }
              result.duplicates++;
              continue;
            }

            await randomDelay();
            const listing = await scrapeListingDetail(page, link.href, link.id);

            if (!listing) {
              result.errors++;
              continue;
            }

            // Emlakçı filtresi
            const filterResult = await filterListing(
              listing.description,
              listing.sellerName ?? undefined
            );

            // Benzer ilan tespiti (aynı başlık + fiyat = muhtemelen aynı ilan farklı ID)
            if (listing.title && listing.price) {
              const similar = await prisma.listing.findFirst({
                where: {
                  title: listing.title,
                  price: listing.price,
                  cityId: city.id,
                  sahibindenId: { not: listing.sahibindenId },
                },
              });
              if (similar) {
                console.log(`Benzer ilan atlandı: ${listing.title} (mevcut: ${similar.sahibindenId})`);
                result.duplicates++;
                continue;
              }
            }

            // Kategori tahmin
            const categoryId = await guessCategory(listing.title);

            // Veritabanına kaydet
            await prisma.listing.create({
              data: {
                sahibindenId: listing.sahibindenId,
                title: listing.title,
                description: listing.description,
                price: listing.price,
                currency: listing.currency,
                listingType: listingType,
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
                categoryId: categoryId,
              },
            });

            if (filterResult.isFromOwner) {
              result.accepted++;
            } else {
              result.rejected++;
            }
          } catch (err) {
            console.error(`İlan hata: ${link.id}`, err);
            result.errors++;
          }
        }
      } catch (err) {
        console.error(`Sayfa hata: ${pageNum}`, err);
        result.errors++;
      }
    }

    result.duration = Date.now() - startTime;

    // Scraper run güncelle
    await prisma.scraperRun.update({
      where: { id: scraperRun.id },
      data: {
        totalFound: result.totalFound,
        accepted: result.accepted,
        rejected: result.rejected,
        duplicates: result.duplicates,
        errors: result.errors,
        duration: result.duration,
        status: "completed",
        completedAt: new Date(),
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
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function scrapeListingDetail(
  page: Page,
  url: string,
  sahibindenId: string,
  retries: number = 2
): Promise<ScrapedListing | null> {
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    const data = await page.evaluate(() => {
      const title =
        document.querySelector(".classifiedDetailTitle h1")?.textContent?.trim() || "";
      const description =
        document.querySelector("#classifiedDescription")?.textContent?.trim() || "";

      // Fiyat
      const priceText =
        document.querySelector(".classifiedInfo h3")?.textContent?.trim() || "";
      const priceMatch = priceText.replace(/[^0-9]/g, "");
      const price = priceMatch ? parseInt(priceMatch) : null;
      const currency = priceText.includes("$")
        ? "USD"
        : priceText.includes("€")
          ? "EUR"
          : "TL";

      // Konum
      const locationLinks = document.querySelectorAll(
        ".classifiedInfo h2 a"
      );
      const locationParts = Array.from(locationLinks).map(
        (a) => a.textContent?.trim() || ""
      );

      // İlan detayları tablosundan bilgi çek
      const infoItems = document.querySelectorAll(
        ".classifiedInfoList li"
      );
      const info: Record<string, string> = {};
      infoItems.forEach((item) => {
        const label = item.querySelector("strong")?.textContent?.trim() || "";
        const value = item.querySelector("span")?.textContent?.trim() || "";
        if (label && value) info[label] = value;
      });

      // Fotoğraflar
      const images = document.querySelectorAll(
        ".classifiedDetailPhotos img"
      );
      const imageUrls = Array.from(images)
        .map((img) => (img as HTMLImageElement).src)
        .filter((src) => src && !src.includes("placeholder"));

      // Satıcı bilgisi
      const sellerName =
        document.querySelector(".username-info-area h5")?.textContent?.trim() ||
        document.querySelector(".storeIcon + h5")?.textContent?.trim() ||
        null;

      return {
        title,
        description,
        price,
        currency,
        location: locationParts.join(", ") || null,
        district: locationParts[1] || null,
        neighborhood: locationParts[2] || null,
        roomCount: info["Oda Sayısı"] || null,
        squareMeters: info["m² (Brüt)"]
          ? parseInt(info["m² (Brüt)"].replace(/[^0-9]/g, ""))
          : info["m² (Net)"]
            ? parseInt(info["m² (Net)"].replace(/[^0-9]/g, ""))
            : null,
        buildingAge: info["Bina Yaşı"] || null,
        floor: info["Bulunduğu Kat"] || null,
        imageUrls,
        sellerName,
      };
    });

    return {
      sahibindenId,
      sourceUrl: url,
      ...data,
    };
  } catch (err) {
    if (retries > 0) {
      console.log(`Retry: ${url} (${retries} kaldı)`);
      await randomDelay();
      return scrapeListingDetail(page, url, sahibindenId, retries - 1);
    }
    console.error(`Detay sayfa hata: ${url}`, err);
    return null;
  }
}

async function guessCategory(title: string): Promise<string | null> {
  const lowerTitle = title.toLowerCase();
  const categoryMap: Record<string, string> = {
    villa: "villa",
    arsa: "arsa",
    tarla: "tarla",
    dükkan: "dukkan",
    dukkan: "dukkan",
    ofis: "ofis",
    depo: "depo",
    bina: "bina",
    müstakil: "mustakil-ev",
    mustakil: "mustakil-ev",
    residans: "residans",
    "devremülk": "devremulk",
    devremulk: "devremulk",
    kooperatif: "kooperatif",
    daire: "daire",
  };

  for (const [keyword, slug] of Object.entries(categoryMap)) {
    if (lowerTitle.includes(keyword)) {
      const category = await prisma.category.findUnique({
        where: { slug },
      });
      return category?.id || null;
    }
  }

  // Varsayılan: daire
  const daire = await prisma.category.findUnique({
    where: { slug: "daire" },
  });
  return daire?.id || null;
}
