/**
 * Sahibinden Cookie Bot
 *
 * Kendi bilgisayarından sahibinden.com'a login olup cookie'leri kaydet.
 * Sonra bu cookie'lerle VPS'den ilan çek.
 *
 * Adım 1: Kendi PC'nde tarayıcıda sahibinden.com'a login ol
 * Adım 2: Tarayıcı konsolunda şunu çalıştır:
 *   copy(document.cookie)
 * Adım 3: Cookie'yi aşağıdaki COOKIES değişkenine yapıştır ve bu scripti çalıştır
 */

import { prisma } from "../src/lib/prisma";

// === BURAYA COOKİE YAPIŞTIR ===
const COOKIES = process.env.SAHIBINDEN_COOKIES || "";

if (!COOKIES) {
  console.log(`
=== Sahibinden Cookie Bot ===

Sahibinden.com'a kendi bilgisayarından login olup cookie al:

1. Tarayıcıda https://www.sahibinden.com'a git ve login ol
2. F12 ile DevTools aç → Console sekmesi
3. Şunu yapıştır ve Enter:
   document.cookie
4. Çıkan metni kopyala
5. .env dosyasına ekle:
   SAHIBINDEN_COOKIES=kopyalanan_cookie_metni
6. Bu scripti tekrar çalıştır:
   npx tsx scripts/sahibinden-cookie-bot.ts
`);
  process.exit(0);
}

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept-Language": "tr-TR,tr;q=0.9",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Cookie": COOKIES,
  "Referer": "https://www.sahibinden.com/",
};

function delay(min = 3000, max = 6000): Promise<void> {
  return new Promise(r => setTimeout(r, min + Math.random() * (max - min)));
}

function normalize(text: string): string {
  const map: Record<string, string> = {"ç":"c","ğ":"g","ı":"i","ö":"o","ş":"s","ü":"u","Ç":"c","Ğ":"g","İ":"i","Ö":"o","Ş":"s","Ü":"u"};
  return text.replace(/[^\x00-\x7F]/g, c => map[c] || "").toLowerCase();
}

const AGENT_WORDS = ["emlak","gayrimenkul","remax","century","coldwell","turyap","danışman","broker","ofisimiz","portföy"];

function isAgent(text: string): boolean {
  const n = normalize(text);
  return AGENT_WORDS.some(w => n.includes(normalize(w)));
}

async function main() {
  console.log("=== Sahibinden Cookie Bot ===\n");
  console.log("Cookie ile sahibinden.com'a bağlanılıyor...\n");

  // Test - anasayfaya eriş
  const testResp = await fetch("https://www.sahibinden.com/satilik/konya/sahibinden", {
    headers: HEADERS,
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  });

  console.log("HTTP:", testResp.status);

  if (testResp.status === 302 || testResp.status === 403) {
    console.error("Cookie geçersiz veya süresi dolmuş. Yeni cookie al.");
    process.exit(1);
  }

  const html = await testResp.text();

  if (html.includes("Giriş") && html.includes("giris")) {
    console.error("Login gerekli - cookie geçersiz. Yeni cookie al.");
    process.exit(1);
  }

  if (html.includes("Olağan dışı") || html.includes("moment")) {
    console.error("Cloudflare challenge - cookie yeterli değil.");
    process.exit(1);
  }

  // İlan linklerini çıkar
  const linkRe = /href="(\/ilan\/[^"]*\/(\d+)\/[^"]*)"/g;
  const links: Array<{href: string; id: string}> = [];
  let m;
  while ((m = linkRe.exec(html)) !== null) {
    if (!links.find(l => l.id === m[2])) {
      links.push({ href: `https://www.sahibinden.com${m[1]}`, id: m[2] });
    }
  }

  console.log(`${links.length} ilan bulundu!\n`);

  if (links.length === 0) {
    console.log("İlan bulunamadı. HTML'in ilk 500 karakteri:");
    console.log(html.substring(0, 500));
    process.exit(1);
  }

  const city = await prisma.city.findUnique({ where: { slug: "konya" } });
  if (!city) process.exit(1);

  let accepted = 0, rejected = 0, duplicates = 0;

  for (const link of links) {
    const existing = await prisma.listing.findUnique({ where: { sahibindenId: link.id } });
    if (existing) { duplicates++; continue; }

    await delay();

    try {
      const resp = await fetch(link.href, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
      const detailHtml = await resp.text();

      // Başlık
      const titleM = detailHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
      const title = titleM ? titleM[1].replace(/<[^>]+>/g, "").trim() : "";
      if (!title) continue;

      // Açıklama
      const descM = detailHtml.match(/id="classifiedDescription"[^>]*>([\s\S]*?)<\/div>/);
      const desc = descM ? descM[1].replace(/<[^>]+>/g, "").trim() : "";

      // Fiyat
      const priceM = detailHtml.match(/classifiedInfo[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/);
      const price = priceM ? parseInt(priceM[1].replace(/[^0-9]/g, "")) || null : null;

      // Emlakçı filtre
      if (isAgent(title + " " + desc)) { rejected++; continue; }

      // Resimler
      const images: string[] = [];
      const imgRe = /data-src="(https:\/\/[^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/gi;
      let im;
      while ((im = imgRe.exec(detailHtml)) !== null) {
        if (!images.includes(im[1])) images.push(im[1]);
      }

      // Konum
      const locRe = /classifiedInfo[^>]*>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/;
      const locM = detailHtml.match(locRe);
      const locParts: string[] = [];
      if (locM) {
        const aRe = /<a[^>]*>([^<]+)<\/a>/g;
        let am;
        while ((am = aRe.exec(locM[1])) !== null) locParts.push(am[1].trim());
      }

      // Oda, m²
      const roomM = detailHtml.match(/Oda\s*Say[ıi]s[ıi]\s*<\/strong>\s*<span[^>]*>([^<]+)/i);
      const sqmM = detailHtml.match(/m²\s*\([^)]+\)\s*<\/strong>\s*<span[^>]*>([^<]+)/i);

      // Satıcı
      const sellerM = detailHtml.match(/username-info-area[\s\S]*?<h5[^>]*>([^<]+)/);

      const catSlug = title.toLowerCase().includes("arsa") ? "arsa" :
        title.toLowerCase().includes("villa") ? "villa" :
        title.toLowerCase().includes("müstakil") ? "mustakil-ev" : "daire";
      const cat = await prisma.category.findUnique({ where: { slug: catSlug } });

      await prisma.listing.create({
        data: {
          sahibindenId: link.id,
          title,
          description: desc.substring(0, 5000),
          price,
          currency: "TL",
          listingType: "SALE",
          location: locParts.join(", ") || "Konya",
          district: locParts[1] || null,
          neighborhood: locParts[2] || null,
          roomCount: roomM ? roomM[1].trim() : null,
          squareMeters: sqmM ? parseInt(sqmM[1].replace(/[^0-9]/g, "")) : null,
          imageUrls: images.slice(0, 20),
          sourceUrl: link.href,
          sellerName: sellerM ? sellerM[1].trim() : "Sahibinden",
          sellerPhone: null,
          isFromOwner: true,
          status: "ACTIVE",
          cityId: city.id,
          categoryId: cat?.id || null,
        },
      });

      accepted++;
      console.log(`✓ ${title.substring(0, 50)} | ${price?.toLocaleString("tr-TR")} TL | ${images.length} foto`);
    } catch {
      // skip
    }
  }

  console.log(`\n=== Sonuç: ${accepted} kabul | ${rejected} red | ${duplicates} dup ===`);
  await prisma.$disconnect();
  process.exit(0);
}

main();
