/**
 * Smart Chrome Bot - Sahibinden.com'dan ilan çeker
 *
 * Mevcut Chrome oturumuna bağlanır (debug port 9222)
 * İnsan davranışını simüle eder
 * Telefon numaralarını da çeker
 * Engel durumunda akıllı bekleme yapar
 */
import puppeteer, { type Page } from "puppeteer";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// --- Yardımcı fonksiyonlar ---
function normalize(t: string) {
  const m: Record<string, string> = {"ç":"c","ğ":"g","ı":"i","ö":"o","ş":"s","ü":"u","Ç":"c","Ğ":"g","İ":"i","Ö":"o","Ş":"s","Ü":"u"};
  return t.replace(/[^\x00-\x7F]/g, c => m[c] || "").toLowerCase();
}

const AGENT_WORDS = ["emlak","gayrimenkul","remax","century","coldwell","turyap","danışman","broker","ofisimiz","portföy","franchise","danismanınız","emlak ofisi","gayrimenkul ofisi","portföy no","şubemiz","mağazamız"];
function isAgent(text: string): boolean {
  const n = normalize(text);
  return AGENT_WORDS.some(w => n.includes(normalize(w)));
}

// Random bekleme (insan gibi)
function humanDelay(minSec: number, maxSec: number): Promise<void> {
  const ms = (minSec + Math.random() * (maxSec - minSec)) * 1000;
  return new Promise(r => setTimeout(r, ms));
}

// İnsan gibi scroll
async function humanScroll(page: Page) {
  const scrollCount = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < scrollCount; i++) {
    const distance = 150 + Math.random() * 400;
    await page.evaluate((d) => window.scrollBy({ top: d, behavior: "smooth" }), distance);
    await humanDelay(0.8, 2.5);
  }
}

// İnsan gibi mouse hareketi
async function humanMouse(page: Page) {
  const x = 200 + Math.random() * 800;
  const y = 150 + Math.random() * 500;
  await page.mouse.move(x, y, { steps: 10 + Math.floor(Math.random() * 20) });
  await humanDelay(0.3, 1);
}

// Engel kontrolü - sayfanın engelli olup olmadığını kontrol et
async function checkBlocked(page: Page): Promise<"ok" | "blocked" | "login" | "captcha"> {
  const url = page.url();
  const title = await page.title().catch(() => "");

  if (url.includes("olagan") || url.includes("tloading") || title.includes("Olağan") || title.includes("moment")) {
    return "blocked";
  }
  if (url.includes("giris") || url.includes("login") || url.includes("secure.sahibinden")) {
    return "login";
  }
  if (title.includes("captcha") || title.includes("Doğrulama")) {
    return "captcha";
  }
  return "ok";
}

// Engel durumunda bekleme
async function handleBlock(page: Page, status: string): Promise<boolean> {
  if (status === "ok") return true;

  if (status === "blocked") {
    console.log("  ⚠ Engel algılandı! 10 dakika bekleniyor...");
    await humanDelay(580, 640);
    // Ana sayfaya git
    await page.goto("https://www.sahibinden.com", { waitUntil: "networkidle2", timeout: 30000 }).catch(() => {});
    await humanDelay(5, 10);
    const newStatus = await checkBlocked(page);
    if (newStatus !== "ok") {
      console.log("  ⚠ Hala engelli! 15 dakika daha bekleniyor...");
      await humanDelay(880, 940);
      await page.goto("https://www.sahibinden.com", { waitUntil: "networkidle2", timeout: 30000 }).catch(() => {});
      await humanDelay(3, 5);
      const finalStatus = await checkBlocked(page);
      return finalStatus === "ok";
    }
    return true;
  }

  if (status === "login") {
    console.log("  🔒 Oturum süresi dolmuş! Manuel login gerekli.");
    console.log("  Chrome'da sahibinden.com'a tekrar login olun.");
    console.log("  30 saniye bekleniyor...");
    await humanDelay(25, 35);
    return false;
  }

  if (status === "captcha") {
    console.log("  🤖 Captcha! Manuel çözüm gerekli. 60 saniye bekleniyor...");
    await humanDelay(55, 65);
    return false;
  }

  return false;
}

// Kategori tahmin
async function guessCategory(title: string): Promise<string | null> {
  const lower = title.toLowerCase();
  const map: Record<string, string> = {
    villa: "villa", arsa: "arsa", tarla: "tarla", müstakil: "mustakil-ev",
    mustakil: "mustakil-ev", dükkan: "dukkan", dukkan: "dukkan", ofis: "ofis",
    daire: "daire", residans: "residans",
  };
  for (const [kw, slug] of Object.entries(map)) {
    if (lower.includes(kw)) {
      const cat = await prisma.category.findUnique({ where: { slug } });
      return cat?.id || null;
    }
  }
  const daire = await prisma.category.findUnique({ where: { slug: "daire" } });
  return daire?.id || null;
}

// İlan detay sayfasından veri çek
async function scrapeDetail(page: Page): Promise<{
  title: string; desc: string; price: number | null; currency: string;
  location: string[]; info: Record<string, string>; images: string[];
  seller: string | null; phone: string | null;
} | null> {
  try {
    // Sayfanın yüklenmesini bekle
    await page.waitForSelector("h1", { timeout: 10000 }).catch(() => {});

    const data = await page.evaluate(() => {
      const title = document.querySelector(".classifiedDetailTitle h1, h1")?.textContent?.trim() || "";
      const desc = document.querySelector("#classifiedDescription")?.textContent?.trim() || "";
      const priceText = document.querySelector(".classifiedInfo h3")?.textContent?.trim() || "";
      const priceNum = parseInt(priceText.replace(/[^0-9]/g, "")) || null;
      const currency = priceText.includes("$") ? "USD" : priceText.includes("€") ? "EUR" : "TL";

      const locLinks = document.querySelectorAll(".classifiedInfo h2 a");
      const location = Array.from(locLinks).map(a => a.textContent?.trim()).filter(Boolean) as string[];

      const info: Record<string, string> = {};
      document.querySelectorAll(".classifiedInfoList li").forEach(li => {
        const label = li.querySelector("strong")?.textContent?.trim() || "";
        const value = li.querySelector("span")?.textContent?.trim() || "";
        if (label && value) info[label] = value;
      });

      // Fotoğraflar - birden fazla selector dene
      const imgs: string[] = [];
      document.querySelectorAll("img[data-src], .classifiedDetailPhotos img, .galleryContainer img").forEach(img => {
        const src = (img as HTMLImageElement).dataset?.src || (img as HTMLImageElement).src || "";
        if (src && !src.includes("placeholder") && !src.includes("data:image") && (src.includes("sahibinden") || src.includes("modacdn"))) {
          imgs.push(src);
        }
      });

      const seller = document.querySelector(".username-info-area h5, .classifiedOwnerInfo h5")?.textContent?.trim() || null;

      return { title, desc, price: priceNum, currency, location, info, images: [...new Set(imgs)].slice(0, 20), seller };
    });

    if (!data.title) return null;

    // Telefon numarasını çekmeye çalış
    let phone: string | null = null;
    try {
      // "Telefonu Göster" butonuna tıkla
      const phoneBtn = await page.$('.classifiedOtherInfoArea .js-phone-number, .phone-button, [class*="phone"] button, a[href*="tel:"]');
      if (phoneBtn) {
        await phoneBtn.click();
        await humanDelay(1.5, 3);

        // Telefon numarasını oku
        const phoneText = await page.evaluate(() => {
          const el = document.querySelector('.classifiedOtherInfoArea .js-phone-number .pretty-phone-part, .phone-number, [class*="phone-number"], a[href^="tel:"]');
          return el?.textContent?.trim() || null;
        });
        if (phoneText) {
          phone = phoneText.replace(/[^0-9+]/g, "");
          if (phone.length < 10) phone = null;
        }
      }
    } catch { /* phone extraction failed, continue */ }

    return { ...data, phone };
  } catch {
    return null;
  }
}

// --- Sahibinden URL'leri (filtre yok - tüm ilanlar, emlakçı filtresi biz yaparız) ---
const CATEGORIES = [
  // Satılık daire - çok sayfalı
  { url: "satilik-daire/konya", type: "SALE" as const },
  { url: "satilik-daire/konya?pagingOffset=20", type: "SALE" as const },
  { url: "satilik-daire/konya?pagingOffset=40", type: "SALE" as const },
  { url: "satilik-daire/konya?pagingOffset=60", type: "SALE" as const },
  { url: "satilik-daire/konya?pagingOffset=80", type: "SALE" as const },
  // Satılık müstakil
  { url: "satilik-mustakil-ev/konya", type: "SALE" as const },
  { url: "satilik-mustakil-ev/konya?pagingOffset=20", type: "SALE" as const },
  // Satılık arsa
  { url: "satilik-arsa/konya", type: "SALE" as const },
  { url: "satilik-arsa/konya?pagingOffset=20", type: "SALE" as const },
  // Satılık villa
  { url: "satilik-villa/konya", type: "SALE" as const },
  // Kiralık
  { url: "kiralik-daire/konya", type: "RENT" as const },
  { url: "kiralik-daire/konya?pagingOffset=20", type: "RENT" as const },
  { url: "kiralik-mustakil-ev/konya", type: "RENT" as const },
];

// --- Ana Bot ---
async function main() {
  console.log("=== EvSahip Smart Chrome Bot ===");
  console.log("İnsan simülasyonu ile sahibinden.com tarama\n");

  // Chrome'a bağlan
  let browser;
  try {
    browser = await puppeteer.connect({ browserURL: "http://localhost:9222" });
    console.log("Chrome'a bağlandı (port 9222)");
  } catch {
    console.error("Chrome bulunamadı! EvSahip-Bot.bat'ı çalıştırın.");
    process.exit(1);
  }

  // Yeni sekme aç - mevcut sekmeyi bozmamak için
  const page = await browser.newPage();
  console.log("Yeni sekme açıldı");

  // Konya şehri
  const city = await prisma.city.findUnique({ where: { slug: "konya" } });
  if (!city) { console.error("Konya bulunamadı!"); process.exit(1); }

  // Scraper kaydı
  const scraperRun = await prisma.scraperRun.create({
    data: { cityId: city.id, status: "running" },
  });

  let accepted = 0, rejected = 0, duplicates = 0, errors = 0, phoneCount = 0;
  const startTime = Date.now();

  // Login kontrolü
  const status = await checkBlocked(page);
  if (status === "login") {
    console.error("\n🔒 Sahibinden'e login olmamışsınız!");
    console.error("Chrome'da https://secure.sahibinden.com/giris adresine gidin ve login olun.");
    browser.disconnect();
    process.exit(1);
  }

  console.log(`\n${CATEGORIES.length} kategori taranacak...\n`);

  for (const cat of CATEGORIES) {
    const catUrl = `https://www.sahibinden.com/${cat.url}`;
    const catName = cat.url.split("/")[0];
    console.log(`\n📂 ${catName} (${cat.type})`);

    // Kategoriye git - insan gibi
    await humanDelay(15, 30); // Sayfalar arası uzun bekleme - engelden kaçın

    try {
      try {
        await page.goto(catUrl, { waitUntil: "networkidle2", timeout: 60000 });
      } catch {
        // Timeout olursa yine devam et, sayfa kısmen yüklenmiş olabilir
        console.log("  Sayfa yükleme yavaş, devam ediliyor...");
      }
      await humanDelay(3, 6);

      // Engel kontrolü
      const pageStatus = await checkBlocked(page);
      const ok = await handleBlock(page, pageStatus);
      if (!ok) {
        console.log(`  Atlanıyor: ${catName}`);
        continue;
      }

      // İlanların yüklenmesini bekle
      await page.waitForSelector('tr[data-id], .searchResultsItem, a.classifiedTitle', { timeout: 15000 }).catch(() => {});
      await humanDelay(2, 4);

      // Sayfa yüklenene kadar bekle + insan davranışı
      await humanScroll(page);
      await humanMouse(page);

      // İlan linklerini topla
      const links = await page.evaluate(() => {
        const results: { href: string; id: string; title: string }[] = [];
        // Birden fazla selector dene
        const selectors = [
          'a.classifiedTitle',
          'tr[data-id] a.classifiedTitle',
          '.searchResultsItem a.classifiedTitle',
          'a[href*="/ilan/emlak"]',
        ];

        for (const sel of selectors) {
          document.querySelectorAll(sel).forEach(a => {
            const href = (a as HTMLAnchorElement).href;
            // ID: URL'deki 8+ haneli sayı (sonunda / veya /detay olabilir)
            const idMatch = href.match(/(\d{8,})/);
            if (idMatch) {
              results.push({
                href,
                id: idMatch[1],
                title: a.textContent?.trim() || "",
              });
            }
          });
          if (results.length > 0) break;
        }

        // Deduplicate
        const seen = new Set<string>();
        return results.filter(r => {
          if (seen.has(r.id)) return false;
          seen.add(r.id);
          return true;
        });
      }).catch(() => [] as { href: string; id: string; title: string }[]);

      console.log(`  ${links.length} ilan bulundu`);

      if (links.length === 0) continue;

      // Her ilana tek tek git (max 8 yeni ilan per kategori - engelden kaçınmak için)
      let newInCategory = 0;
      const MAX_NEW_PER_CAT = 8;
      for (const link of links) {
        if (newInCategory >= MAX_NEW_PER_CAT) {
          console.log(`  ${MAX_NEW_PER_CAT} yeni ilan limiti doldu, sonraki kategoriye geçiliyor`);
          break;
        }
        try {
          // Duplicate kontrolü
          const existing = await prisma.listing.findUnique({ where: { sahibindenId: link.id } });
          if (existing) {
            duplicates++;
            continue;
          }

          // Başlıktan hızlı emlakçı kontrolü
          if (isAgent(link.title)) {
            rejected++;
            continue;
          }

          // İnsan gibi bekleme (8-25 saniye)
          await humanDelay(8, 25);

          // İlan detay sayfasına git
          try {
            await page.goto(link.href, { waitUntil: "networkidle2", timeout: 60000 });
          } catch {
            console.log("  Detay sayfa yükleme yavaş, devam...");
          }
          await humanDelay(3, 6);

          // Engel kontrolü
          const detailStatus = await checkBlocked(page);
          const detailOk = await handleBlock(page, detailStatus);
          if (!detailOk) {
            errors++;
            // Listeye geri dön
            await page.goto(catUrl, { waitUntil: "networkidle2", timeout: 45000 }).catch(() => {});
            await humanDelay(5, 10);
            break; // Bu kategoriyi atla
          }

          // İnsan davranışı - sayfayı oku
          await humanScroll(page);
          await humanMouse(page);

          // Detayları çek
          const data = await scrapeDetail(page);
          if (!data || !data.title) {
            errors++;
            continue;
          }

          // Emlakçı filtresi
          const fullText = data.title + " " + data.desc + " " + (data.seller || "");
          if (isAgent(fullText)) {
            rejected++;
            continue;
          }

          // Kategori tahmin
          const categoryId = await guessCategory(data.title);

          // Veritabanına kaydet
          await prisma.listing.create({
            data: {
              sahibindenId: link.id,
              title: data.title,
              description: data.desc.substring(0, 5000),
              price: data.price,
              currency: data.currency,
              listingType: cat.type,
              location: data.location.join(", ") || "Konya",
              district: data.location[1] || null,
              neighborhood: data.location[2] || null,
              roomCount: data.info["Oda Sayısı"] || null,
              squareMeters: data.info["m² (Brüt)"] ? parseInt(data.info["m² (Brüt)"].replace(/[^0-9]/g, "")) : null,
              buildingAge: data.info["Bina Yaşı"] || null,
              floor: data.info["Bulunduğu Kat"] || null,
              imageUrls: data.images,
              sourceUrl: link.href,
              sellerName: data.seller || "Sahibinden",
              sellerPhone: data.phone,
              isFromOwner: true,
              status: "ACTIVE",
              cityId: city.id,
              categoryId,
            },
          });

          accepted++;
          newInCategory++;
          if (data.phone) phoneCount++;

          const priceStr = data.price ? `${data.price.toLocaleString("tr-TR")} TL` : "?";
          const phoneStr = data.phone ? ` | 📞 ${data.phone}` : "";
          console.log(`  ✓ ${data.title.substring(0, 50)} | ${priceStr}${phoneStr}`);

        } catch (err) {
          errors++;
          const msg = err instanceof Error ? err.message.substring(0, 60) : "";
          if (msg) console.log(`  ✗ Hata: ${msg}`);
        }
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message.substring(0, 60) : "";
      console.log(`  Kategori hata: ${msg}`);
      errors++;
    }
  }

  // Sonuçları kaydet
  const duration = Date.now() - startTime;
  await prisma.scraperRun.update({
    where: { id: scraperRun.id },
    data: {
      totalFound: accepted + rejected + duplicates,
      accepted,
      rejected,
      duplicates,
      errors,
      duration,
      status: "completed",
      completedAt: new Date(),
    },
  });

  console.log(`\n${"=".repeat(50)}`);
  console.log(`SONUÇ:`);
  console.log(`  ✓ ${accepted} yeni ilan eklendi`);
  console.log(`  📞 ${phoneCount} telefon numarası`);
  console.log(`  ✗ ${rejected} emlakçı filtrelendi`);
  console.log(`  ↺ ${duplicates} duplicate atlandı`);
  console.log(`  ! ${errors} hata`);
  console.log(`  ⏱ ${(duration / 60000).toFixed(1)} dakika`);
  console.log(`${"=".repeat(50)}`);

  await page.close().catch(() => {});
  browser.disconnect();
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
