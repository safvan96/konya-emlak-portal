import puppeteer, { type Browser, type Page } from "puppeteer";
import { prisma } from "../prisma";
import { filterListing } from "./filter";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
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

  // Proxy ayarları
  const proxyUrl = process.env.PROXY_URL; // örn: http://user:pass@host:port
  const proxyHost = process.env.PROXY_HOST;
  const proxyPort = process.env.PROXY_PORT;
  const proxyUser = process.env.PROXY_USER;
  const proxyPass = process.env.PROXY_PASS;

  const hasProxy = proxyUrl || (proxyHost && proxyPort);

  try {
    const launchArgs = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-blink-features=AutomationControlled",
    ];

    // Proxy varsa Puppeteer'a ekle
    if (proxyUrl) {
      const parsed = new URL(proxyUrl);
      launchArgs.push(`--proxy-server=${parsed.hostname}:${parsed.port}`);
    } else if (proxyHost && proxyPort) {
      launchArgs.push(`--proxy-server=${proxyHost}:${proxyPort}`);
    }

    browser = await puppeteer.launch({
      headless: true,
      args: launchArgs,
    });

    const page = await browser.newPage();

    // Proxy auth
    if (proxyUrl) {
      const parsed = new URL(proxyUrl);
      if (parsed.username && parsed.password) {
        await page.authenticate({ username: decodeURIComponent(parsed.username), password: decodeURIComponent(parsed.password) });
      }
    } else if (proxyUser && proxyPass) {
      await page.authenticate({ username: proxyUser, password: proxyPass });
    }

    await page.setUserAgent(randomUserAgent());
    await page.setViewport({ width: 1366, height: 768 });

    // Anti-detection
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'languages', { get: () => ['tr-TR', 'tr', 'en-US', 'en'] });
      Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
      // @ts-ignore
      window.chrome = { runtime: {}, loadTimes: () => {}, csi: () => {} };
    });

    // Gerçekçi HTTP headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Upgrade-Insecure-Requests': '1',
    });

    // Cookie consent ve popup'lari otomatik kapat
    page.on("dialog", async (dialog) => { await dialog.dismiss(); });
    await page.evaluateOnNewDocument(() => {
      const style = document.createElement("style");
      style.textContent = "#onetrust-consent-sdk, .cookie-consent, [class*='cookie'], [id*='cookie'] { display: none !important; }";
      document.head.appendChild(style);
    });

    console.log(`Proxy: ${hasProxy ? "AKTIF" : "YOK (direkt bağlantı)"}`);

    // Sahibinden login gerekiyorsa cookie ile giris yap
    const sbEmail = process.env.SAHIBINDEN_EMAIL;
    const sbPassword = process.env.SAHIBINDEN_PASSWORD;
    if (sbEmail && sbPassword) {
      try {
        console.log("Sahibinden login yapiliyor...");
        await page.goto("https://secure.sahibinden.com/giris", { waitUntil: "networkidle2", timeout: 30000 });
        await randomDelay();
        await page.type('input[name="username"], input[type="email"]', sbEmail, { delay: 80 + Math.random() * 40 });
        await randomDelay();
        await page.type('input[name="password"], input[type="password"]', sbPassword, { delay: 80 + Math.random() * 40 });
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));
        await page.click('button[type="submit"], #loginSubmit');
        await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {});
        console.log("Login tamamlandi, URL:", page.url());
        await randomDelay();
      } catch (loginErr) {
        console.log("Login basarisiz, devam ediliyor:", loginErr instanceof Error ? loginErr.message : "bilinmeyen hata");
      }
    }

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

        // Login redirect veya captcha kontrolu
        const currentUrl = page.url();
        const pageTitle = await page.title();
        if (currentUrl.includes("login") || currentUrl.includes("secure.sahibinden") || currentUrl.includes("giris")) {
          console.error("Sahibinden login gerektiriyor! SAHIBINDEN_EMAIL/PASSWORD env ayarlayin veya PROXY_URL tanimlayın.");
          throw new Error("Sahibinden login gerekli - VPS IP engellenmiş olabilir. Residential proxy kullanın.");
        }
        if (pageTitle.includes("Olağan dışı") || pageTitle.includes("erişim tespit")) {
          console.error("Sahibinden captcha/bot tespiti! Residential proxy gerekli.");
          throw new Error("Sahibinden bot tespiti - Residential proxy kullanın (PROXY_URL env).");
        }

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

/**
 * Akıllı scraper - ortama göre otomatik mod seçer:
 * 1. SCRAPER_API_KEY veya ZENROWS_API_KEY varsa → HTTP mod (en güvenilir)
 * 2. PROXY_URL varsa → Puppeteer proxy mod
 * 3. SCRAPER_MODE=search → DuckDuckGo arama motoru modu (API key gerektirmez)
 * 4. Varsayılan → Puppeteer direkt mod (sadece ev/residential IP'sinde çalışır)
 */
export async function smartScrape(
  citySlug: string,
  listingType: "SALE" | "RENT" = "SALE",
  maxPages: number = 3
): Promise<ScrapeResult> {
  const mode = process.env.SCRAPER_MODE;

  // ScraperAPI veya Zenrows varsa HTTP modunu kullan
  if (process.env.SCRAPER_API_KEY || process.env.ZENROWS_API_KEY) {
    console.log("=== HTTP Scraper modu (API key) ===");
    const { scrapeWithHttp } = await import("./http-scraper");
    return scrapeWithHttp(citySlug, listingType, maxPages);
  }

  // Emlakjet modu - API key gerektirmez, VPS'den direkt çalışır
  if (mode === "emlakjet" || (!process.env.PROXY_URL && !process.env.SAHIBINDEN_EMAIL)) {
    console.log("=== Emlakjet Scraper modu (API key gerektirmez) ===");
    const { scrapeEmlakjet } = await import("./emlakjet-scraper");
    return scrapeEmlakjet(citySlug, listingType, maxPages);
  }

  // Puppeteer ile dene
  console.log("=== Puppeteer Scraper modu ===");
  return scrapeSahibinden(citySlug, listingType, maxPages);
}
