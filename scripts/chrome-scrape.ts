/**
 * Chrome Debug Bot - RDP ile login olduktan sonra ilanları çeker.
 *
 * Kullanım:
 * 1. VPS'e RDP ile bağlan
 * 2. Masaüstünde "sahibinden-login.bat" çalıştır
 * 3. Chrome'da sahibinden'e login ol
 * 4. Bat dosyasında ENTER'a bas
 * 5. Bot ilanları otomatik çeker
 */
import puppeteer from "puppeteer";
import { prisma } from "../src/lib/prisma";

function normalize(text: string): string {
  const map: Record<string, string> = {"ç":"c","ğ":"g","ı":"i","ö":"o","ş":"s","ü":"u","Ç":"c","Ğ":"g","İ":"i","Ö":"o","Ş":"s","Ü":"u"};
  return text.replace(/[^\x00-\x7F]/g, c => map[c] || "").toLowerCase();
}

const AGENT_WORDS = ["emlak","gayrimenkul","remax","century","coldwell","turyap","danışman","broker","ofisimiz","portföy","franchise"];
function isAgent(text: string): boolean {
  const n = normalize(text);
  return AGENT_WORDS.some(w => n.includes(normalize(w)));
}

function delay(ms = 3000): Promise<void> {
  return new Promise(r => setTimeout(r, ms + Math.random() * 2000));
}

async function main() {
  console.log("Chrome'a bağlanılıyor (port 9222)...\n");

  const browser = await puppeteer.connect({ browserURL: "http://localhost:9222" });
  const pages = await browser.pages();
  const page = pages[pages.length - 1];

  // Login kontrolü
  const url = page.url();
  console.log("Mevcut URL:", url);

  if (url.includes("giris") || url.includes("login")) {
    console.error("Henüz login olmamışsın! Tarayıcıda sahibinden'e login ol ve tekrar dene.");
    browser.disconnect();
    process.exit(1);
  }

  console.log("Login OK! İlanlar çekiliyor...\n");

  const city = await prisma.city.findUnique({ where: { slug: "konya" } });
  if (!city) { console.error("Konya bulunamadı"); process.exit(1); }

  const scraperRun = await prisma.scraperRun.create({
    data: { cityId: city.id, status: "running" },
  });

  let accepted = 0, rejected = 0, duplicates = 0, errors = 0;
  const startTime = Date.now();

  // Satılık + Kiralık sayfaları
  const urls = [
    "https://www.sahibinden.com/satilik/konya/sahibinden",
    "https://www.sahibinden.com/satilik/konya/sahibinden?pagingOffset=20",
    "https://www.sahibinden.com/satilik/konya/sahibinden?pagingOffset=40",
    "https://www.sahibinden.com/kiralik/konya/sahibinden",
    "https://www.sahibinden.com/kiralik/konya/sahibinden?pagingOffset=20",
  ];

  for (const listUrl of urls) {
    console.log(`\nSayfa: ${listUrl}`);

    try {
      await page.goto(listUrl, { waitUntil: "networkidle2", timeout: 30000 });
      await delay(3000);

      // Erişim kontrolü
      const title = await page.title();
      if (title.includes("Olağan") || title.includes("moment") || title.includes("dakika")) {
        console.log("  Engel! 10sn bekleniyor...");
        await delay(10000);
      }

      // İlan linklerini topla
      const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll(".searchResultsItem a.classifiedTitle"))
          .map(a => ({
            href: (a as HTMLAnchorElement).href,
            id: (a as HTMLAnchorElement).href.match(/\/(\d+)\//)?.[1] || "",
          }))
          .filter(l => l.id);
      });

      console.log(`  ${links.length} ilan bulundu`);

      for (const link of links) {
        try {
          const existing = await prisma.listing.findUnique({ where: { sahibindenId: link.id } });
          if (existing) { duplicates++; continue; }

          await delay();
          await page.goto(link.href, { waitUntil: "networkidle2", timeout: 30000 });

          const data = await page.evaluate(() => {
            const title = document.querySelector(".classifiedDetailTitle h1")?.textContent?.trim() || "";
            const desc = document.querySelector("#classifiedDescription")?.textContent?.trim() || "";
            const priceText = document.querySelector(".classifiedInfo h3")?.textContent?.trim() || "";
            const price = parseInt(priceText.replace(/[^0-9]/g, "")) || null;

            const locLinks = document.querySelectorAll(".classifiedInfo h2 a");
            const location = Array.from(locLinks).map(a => a.textContent?.trim()).filter(Boolean);

            const info: Record<string, string> = {};
            document.querySelectorAll(".classifiedInfoList li").forEach(li => {
              const label = li.querySelector("strong")?.textContent?.trim() || "";
              const value = li.querySelector("span")?.textContent?.trim() || "";
              if (label && value) info[label] = value;
            });

            const images = Array.from(document.querySelectorAll("img[data-src]"))
              .map(img => (img as HTMLImageElement).dataset.src || "")
              .filter(src => src && src.includes("sahibinden") && !src.includes("placeholder"));

            const seller = document.querySelector(".username-info-area h5")?.textContent?.trim() || null;

            return { title, desc, price, location, info, images, seller };
          });

          if (!data.title) { errors++; continue; }

          // Emlakçı filtre
          if (isAgent(data.title + " " + data.desc + " " + (data.seller || ""))) {
            rejected++;
            continue;
          }

          const listingType = listUrl.includes("kiralik") ? "RENT" as const : "SALE" as const;
          const catSlug = normalize(data.title).includes("arsa") ? "arsa" :
            normalize(data.title).includes("villa") ? "villa" :
            normalize(data.title).includes("mustakil") ? "mustakil-ev" : "daire";
          const cat = await prisma.category.findUnique({ where: { slug: catSlug } });

          await prisma.listing.create({
            data: {
              sahibindenId: link.id,
              title: data.title,
              description: data.desc.substring(0, 5000),
              price: data.price,
              currency: "TL",
              listingType,
              location: data.location.join(", ") || "Konya",
              district: data.location[1] || null,
              neighborhood: data.location[2] || null,
              roomCount: data.info["Oda Sayısı"] || null,
              squareMeters: data.info["m² (Brüt)"] ? parseInt(data.info["m² (Brüt)"].replace(/[^0-9]/g, "")) : null,
              buildingAge: data.info["Bina Yaşı"] || null,
              floor: data.info["Bulunduğu Kat"] || null,
              imageUrls: data.images.slice(0, 20),
              sourceUrl: link.href,
              sellerName: data.seller || "Sahibinden",
              sellerPhone: null,
              isFromOwner: true,
              status: "ACTIVE",
              cityId: city.id,
              categoryId: cat?.id || null,
            },
          });

          accepted++;
          console.log(`  ✓ ${data.title.substring(0, 55)} | ${data.price?.toLocaleString("tr-TR")} TL | ${data.images.length} foto`);
        } catch (err) {
          errors++;
        }
      }
    } catch (err) {
      console.error("  Sayfa hata:", err instanceof Error ? err.message : "");
    }
  }

  const duration = Date.now() - startTime;
  await prisma.scraperRun.update({
    where: { id: scraperRun.id },
    data: { totalFound: accepted + rejected + duplicates, accepted, rejected, duplicates, errors, duration, status: "completed", completedAt: new Date() },
  });

  console.log(`\n=== SONUÇ ===`);
  console.log(`Sahibinden: ${accepted} ilan çekildi | ${rejected} emlakçı | ${duplicates} duplicate | ${errors} hata`);
  console.log(`Süre: ${(duration / 1000).toFixed(0)}s`);

  browser.disconnect();
  await prisma.$disconnect();
  process.exit(0);
}

main();
