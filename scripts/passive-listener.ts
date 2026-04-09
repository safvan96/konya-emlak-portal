/**
 * Pasif İlan Dinleyicisi
 *
 * Bu bot HİÇ istek yapmaz - sadece kullanıcının yaptığı istekleri dinler.
 * Kullanıcı sahibinden'de gezinirken her açılan ilanı otomatik kaydeder.
 *
 * Kullanım:
 * 1. Chrome debug modda aç (port 9222)
 * 2. Sahibinden'e login ol
 * 3. Bu botu çalıştır - arka planda dinler
 * 4. Sahibinden'de normal şekilde gezin (ilan tıkla, geri dön, başka ilan tıkla)
 * 5. Her ilan otomatik DB'ye kaydedilir - CAPTCHA yakalanma şansı 0
 */
import puppeteer, { type Page } from "puppeteer";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalize(t: string) {
  const m: Record<string, string> = {"ç":"c","ğ":"g","ı":"i","ö":"o","ş":"s","ü":"u","Ç":"c","Ğ":"g","İ":"i","Ö":"o","Ş":"s","Ü":"u"};
  return t.replace(/[^\x00-\x7F]/g, c => m[c] || "").toLowerCase();
}

const AGENT = ["emlak","gayrimenkul","remax","century","coldwell","turyap","danışman","broker","ofisimiz","portföy"];
function isAgent(t: string) { return AGENT.some(w => normalize(t).includes(normalize(w))); }

async function extractAndSave(page: Page, url: string, cityId: string): Promise<boolean> {
  try {
    // İlan ID'sini URL'den çıkar
    const idMatch = url.match(/(\d{8,})/);
    if (!idMatch) return false;
    const id = idMatch[1];

    // Zaten var mı?
    const existing = await prisma.listing.findUnique({ where: { sahibindenId: id } });
    if (existing) return false;

    // Detayları çek
    const data = await page.evaluate(() => {
      const t = document.querySelector("h1")?.textContent?.trim() || "";
      const d = document.querySelector("#classifiedDescription")?.textContent?.trim() || "";
      const pr = document.querySelector(".classifiedInfo h3")?.textContent?.trim() || "";
      const loc = Array.from(document.querySelectorAll(".classifiedInfo h2 a")).map(a => a.textContent?.trim()).filter(Boolean) as string[];
      const imgs = Array.from(document.querySelectorAll("img[data-src]")).map(i => (i as HTMLImageElement).dataset.src || "").filter(s => s && !s.includes("placeholder")).slice(0, 20);
      const seller = document.querySelector(".username-info-area h5")?.textContent?.trim() || null;
      const info: Record<string, string> = {};
      document.querySelectorAll(".classifiedInfoList li").forEach(li => {
        const l = li.querySelector("strong")?.textContent?.trim();
        const v = li.querySelector("span")?.textContent?.trim();
        if (l && v) info[l] = v;
      });
      return { t, d, price: parseInt(pr.replace(/[^0-9]/g, "")) || null, loc, imgs, seller, info };
    });

    if (!data.t) return false;
    if (isAgent(data.t + " " + data.d + " " + (data.seller || ""))) return false;

    const isRent = url.includes("kiralik");
    const cs = normalize(data.t);
    const catSlug = cs.includes("arsa") ? "arsa" : cs.includes("villa") ? "villa" : cs.includes("mustakil") ? "mustakil-ev" : "daire";
    const cat = await prisma.category.findUnique({ where: { slug: catSlug } });

    await prisma.listing.create({
      data: {
        sahibindenId: id,
        title: data.t,
        description: data.d.substring(0, 5000),
        price: data.price,
        currency: "TL",
        listingType: isRent ? "RENT" : "SALE",
        location: data.loc.join(", ") || "Konya",
        district: data.loc[1] || null,
        neighborhood: data.loc[2] || null,
        roomCount: data.info["Oda Sayısı"] || null,
        squareMeters: data.info["m² (Brüt)"] ? parseInt(data.info["m² (Brüt)"].replace(/[^0-9]/g, "")) : null,
        buildingAge: data.info["Bina Yaşı"] || null,
        floor: data.info["Bulunduğu Kat"] || null,
        imageUrls: data.imgs,
        sourceUrl: url,
        sellerName: data.seller || "Sahibinden",
        sellerPhone: null,
        isFromOwner: true,
        status: "ACTIVE",
        cityId,
        categoryId: cat?.id || null,
      },
    });

    console.log(`✓ ${data.t.substring(0, 50)} | ${data.price?.toLocaleString("tr-TR")} TL`);
    return true;
  } catch (err) {
    return false;
  }
}

async function main() {
  console.log("=== Pasif İlan Dinleyicisi ===\n");
  console.log("Sen sahibinden'de gezerken ilanlar otomatik kaydedilir.");
  console.log("Bot HİÇ istek yapmaz - sadece dinler!\n");

  const browser = await puppeteer.connect({ browserURL: "http://localhost:9222" });
  const city = await prisma.city.findUnique({ where: { slug: "konya" } });
  if (!city) { console.error("Konya yok"); process.exit(1); }

  const pages = await browser.pages();
  const page = pages[0];

  let savedCount = 0;
  let lastUrl = "";

  // Her sayfa değişimini dinle
  const checkUrl = async () => {
    try {
      const url = page.url();

      if (url === lastUrl) return;
      lastUrl = url;

      // İlan detay sayfası mı?
      if (url.includes("sahibinden.com/ilan/") && !url.includes("giris") && !url.includes("login")) {
        // Sayfa yüklenmesini bekle
        await new Promise(r => setTimeout(r, 2000));
        const saved = await extractAndSave(page, url, city.id);
        if (saved) savedCount++;
      }
    } catch { /* skip */ }
  };

  // Sürekli URL kontrolü (her 2 saniyede bir)
  console.log("Dinleme başladı! Sahibinden'de gezinmeye başla.\n");
  console.log("Her açtığın ilan otomatik kaydedilecek.\n");
  console.log("Durdurmak için Ctrl+C\n");

  const interval = setInterval(checkUrl, 2000);

  // Stats her 30 saniyede
  setInterval(async () => {
    const total = await prisma.listing.count();
    console.log(`📊 ${new Date().toLocaleTimeString("tr-TR")} | Bu oturumda kayıt: ${savedCount} | DB toplam: ${total}`);
  }, 30000);

  // Sonsuz çalış
  await new Promise(() => {});
}

main().catch(e => { console.error(e); process.exit(1); });
