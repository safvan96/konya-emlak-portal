/**
 * Sahibinden Yavaş Bot - Rate limit yememek için
 * Her ilan arası 60-120 saniye bekler
 * Engel yerse 5 dakika bekler
 * Chrome debug port 9222'ye bağlanır
 */
import puppeteer from "puppeteer";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalize(t: string) {
  const m: Record<string, string> = {"ç":"c","ğ":"g","ı":"i","ö":"o","ş":"s","ü":"u","Ç":"c","Ğ":"g","İ":"i","Ö":"o","Ş":"s","Ü":"u"};
  return t.replace(/[^\x00-\x7F]/g, c => m[c] || "").toLowerCase();
}

const AGENT = ["emlak","gayrimenkul","remax","century","coldwell","turyap","danışman","broker","ofisimiz","portföy"];
function isAgent(t: string) { return AGENT.some(w => normalize(t).includes(normalize(w))); }

function delay(min = 60000, max = 120000) {
  const ms = min + Math.random() * (max - min);
  console.log(`  ⏳ ${Math.round(ms/1000)}sn bekleniyor...`);
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log("=== Sahibinden Yavaş Bot ===\n");

  const browser = await puppeteer.connect({ browserURL: "http://localhost:9222" });
  const [page] = await browser.pages();
  const city = await prisma.city.findUnique({ where: { slug: "konya" } });
  if (!city) { console.error("Konya yok"); process.exit(1); }

  let accepted = 0, dup = 0, blocked = 0;

  const categories = [
    "satilik-daire", "satilik-mustakil-ev", "satilik-arsa",
    "satilik-villa", "kiralik-daire", "kiralik",
  ];

  for (const cat of categories) {
    const listUrl = `https://www.sahibinden.com/${cat}/konya/sahibinden`;
    console.log(`\n📂 ${cat}`);

    await delay(30000, 45000);
    await page.goto(listUrl, { waitUntil: "networkidle2", timeout: 30000 });
    await delay(10000, 15000);

    // Engel kontrolü
    const title = await page.title();
    if (title.includes("Olağan") || title.includes("Hata") || page.url().includes("olagan")) {
      console.log("  🚫 ENGEL! 5dk bekleniyor...");
      blocked++;
      await delay(300000, 360000);
      continue;
    }

    if (page.url().includes("giris") || page.url().includes("login")) {
      console.log("  🔒 LOGIN GEREKLİ! RDP'den giriş yap.");
      break;
    }

    const items = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("tr[data-id]")).map(tr => ({
        id: tr.getAttribute("data-id") || "",
        href: (tr.querySelector('a[href*="/ilan/"]') as HTMLAnchorElement)?.href || "",
      })).filter(x => x.id && x.href);
    });

    console.log(`  📋 ${items.length} ilan bulundu`);

    for (const item of items) {
      const existing = await prisma.listing.findUnique({ where: { sahibindenId: item.id } });
      if (existing) { dup++; continue; }

      // YAVAŞ bekle
      await delay();

      try {
        await page.goto(item.href, { waitUntil: "networkidle2", timeout: 30000 });
        await delay(8000, 12000);

        const detTitle = await page.title();
        if (detTitle.includes("Olağan") || detTitle.includes("Hata")) {
          console.log("  🚫 Rate limit! 5dk bekleniyor...");
          blocked++;
          await delay(300000, 360000);
          continue;
        }

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

        if (!data.t) continue;
        if (isAgent(data.t + " " + data.d + " " + (data.seller || ""))) continue;

        const type = cat.includes("kiralik") ? "RENT" as const : "SALE" as const;
        const cs = normalize(data.t);
        const catSlug = cs.includes("arsa") ? "arsa" : cs.includes("villa") ? "villa" : cs.includes("mustakil") ? "mustakil-ev" : "daire";
        const dbCat = await prisma.category.findUnique({ where: { slug: catSlug } });

        await prisma.listing.create({
          data: {
            sahibindenId: item.id, title: data.t, description: data.d.substring(0, 5000),
            price: data.price, currency: "TL", listingType: type,
            location: data.loc.join(", ") || "Konya", district: data.loc[1] || null, neighborhood: data.loc[2] || null,
            roomCount: data.info["Oda Sayısı"] || null,
            squareMeters: data.info["m² (Brüt)"] ? parseInt(data.info["m² (Brüt)"].replace(/[^0-9]/g, "")) : null,
            imageUrls: data.imgs, sourceUrl: item.href,
            sellerName: data.seller || "Sahibinden", sellerPhone: null,
            isFromOwner: true, status: "ACTIVE", cityId: city.id, categoryId: dbCat?.id || null,
          },
        });

        accepted++;
        console.log(`  ✅ ${data.t.substring(0, 45)} | ${data.price?.toLocaleString("tr-TR")} TL | ${data.imgs.length} foto`);
      } catch { /* skip */ }
    }
  }

  console.log(`\n=== SONUÇ: ${accepted} yeni | ${dup} dup | ${blocked} engel ===`);
  console.log("DB:", await prisma.listing.count());

  browser.disconnect();
  await prisma.$disconnect();
  process.exit(0);
}

main();
