/**
 * EvSahip Bot - Konya emlak ilanı toplama botu.
 *
 * Emlakjet.com'da sahibinden filtresiyle sayfa sayfa gezer,
 * her ilanın detayına tek tek girer, bilgileri çeker.
 *
 * Agresif emlakçı filtreleme:
 * - "gayrimenkul", "emlak" kelimesi geçen her ilan reddedilir
 * - Kişi ismi pattern'i tespiti (örn: "Kerem Nükte'den", "Ali Veli Emlak")
 * - Açıklamada firma/ofis dili kullanan ilanlar reddedilir
 * - Sadece gerçek sahibinden ilanları kabul edilir
 */

import { prisma } from "../prisma";
import type { ScrapeResult } from "./sahibinden";

// Emlakçı tespiti için agresif kelime listesi
const AGENT_KEYWORDS = [
  // Firma türleri
  "emlak", "gayrimenkul", "remax", "re/max", "century 21", "coldwell banker",
  "keller williams", "turyap", "realty", "estate",
  // Ofis/firma dili
  "ofisimiz", "şubemiz", "firması", "firmasi", "franchise", "portföy",
  "portfoy", "referans no", "ilan no:", "danışman", "danismani", "müşavir",
  "broker", "profesyonel ekip", "hizmet veriyoruz", "hizmet vermekteyiz",
  // Yapı/inşaat firmaları
  "inşaat", "insaat", "müteahhit", "muteahhit", "yap[ıi]", "konut a.ş",
  "group", "holding",
  // İletişim yönlendirmeleri (emlakçı paterni)
  "arayınız", "arayiniz", "bizi arayın", "bize ulaşın", "iletişime geçiniz",
  "detaylı bilgi için arayın",
];

// Türkçe karakter normalizasyonu
function normalize(text: string): string {
  const map: Record<string, string> = {
    "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u",
    "Ç": "c", "Ğ": "g", "İ": "i", "Ö": "o", "Ş": "s", "Ü": "u",
  };
  return text.replace(/[^\x00-\x7F]/g, (c) => map[c] || "").toLowerCase();
}

// Kişi ismi + "den/dan/tan" pattern tespiti
// Örn: "Kerem Nükte'den", "Ali Veli'den satılık"
function hasAgentNamePattern(text: string): boolean {
  // "Sahibinden" ve "Emlakjet" kelimelerini hariç tut
  const cleaned = text.replace(/\bSahibinden\b/g, "___").replace(/\bEmlakjet\b/gi, "___");
  // "XxxDen", "Xxx'den", "Xxx'dan" pattern (kişi ismi + den/dan)
  if (/[A-ZÇĞİÖŞÜ][a-zçğıöşü]{2,}[''][dt][ea]n\b/u.test(cleaned)) return true;
  // "Xxx Emlak", "Xxx Gayrimenkul" (açık firma adı - tek kelime "Emlak" değil, firma adı+Emlak)
  if (/[A-ZÇĞİÖŞÜ][a-zçğıöşü]+\s+Emlak(?!\w)/u.test(cleaned)) return true;
  if (/[A-ZÇĞİÖŞÜ][a-zçğıöşü]+\s+Gayrimenkul/u.test(cleaned)) return true;
  return false;
}

interface BotFilterResult {
  isOwner: boolean;
  reason: string | null;
}

function botFilter(description: string, title: string, sellerName: string | null): BotFilterResult {
  // "Emlakjet - #xxxxx" site attribution'ı kaldır
  const cleanDesc = description.replace(/Emlakjet\s*-\s*#\d+/gi, "").trim();
  const allText = normalize([cleanDesc, title, sellerName].filter(Boolean).join(" "));

  // 1. Agresif kelime kontrolü
  for (const kw of AGENT_KEYWORDS) {
    if (allText.includes(normalize(kw))) {
      return { isOwner: false, reason: `Kelime: ${kw}` };
    }
  }

  // 2. Orijinal metinde kişi ismi + "den/dan" pattern
  const origText = [description, title, sellerName].filter(Boolean).join(" ");
  if (hasAgentNamePattern(origText)) {
    return { isOwner: false, reason: `İsim pattern: ${origText.substring(0, 50)}` };
  }

  // 3. Açıklamanın başında firma adı (Emlakjet formatı)
  // "XyzFirma MahallesiAdı İlçe Şehir konumunda"
  const descFirst80 = allText.substring(0, 80);
  if (/emlak|gayrimenkul/.test(descFirst80) && !/sahibinden/.test(descFirst80)) {
    return { isOwner: false, reason: `Açıklama başında firma: ${description.substring(0, 50)}` };
  }

  // 4. 3+ telefon numarası
  const phones = description.match(/0?\d{3}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/g);
  if (phones && phones.length >= 3) {
    return { isOwner: false, reason: `${phones.length} telefon numarası` };
  }

  // 5. Harici web sitesi
  const urls = description.match(/(?:www\.|https?:\/\/)[\w.-]+\.(?:com|net|org|com\.tr)/gi);
  if (urls) {
    const ext = urls.filter(u => !u.includes("sahibinden") && !u.includes("emlakjet"));
    if (ext.length > 0) {
      return { isOwner: false, reason: `Harici site: ${ext[0]}` };
    }
  }

  return { isOwner: true, reason: null };
}

function randomDelay(min = 2000, max = 5000): Promise<void> {
  return new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));
}

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept-Language": "tr-TR,tr;q=0.9",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

// Konya ilçe eşleştirmesi
const KONYA_DISTRICTS: Record<string, string> = {
  "selcuklu":"selcuklu","meram":"meram","karatay":"karatay",
  "beysehir":"beysehir","aksehir":"aksehir","eregli":"eregli",
  "seydisehir":"seydisehir","cihanbeyli":"cihanbeyli","cumra":"cumra",
  "ilgin":"ilgin","kulu":"kulu","bozkir":"bozkir","hadim":"hadim",
  "sarayonu":"sarayonu","derebucak":"derebucak","emirgazi":"emirgazi",
  "akoren":"akoren","halkapinar":"halkapinar","altinekin":"altinekin",
  "tuzlukcu":"tuzlukcu","yunak":"yunak",
};

function buildSbUrl(title: string, type: string, citySlug: string): string {
  const t = normalize(title);
  let cat = "daire";
  if (t.includes("arsa") || t.includes("tarla") || t.includes("imarli") || t.includes("bag")) cat = "arsa";
  else if (t.includes("villa")) cat = "villa";
  else if (t.includes("mustakil") || t.includes("koy evi") || t.includes("ciftlik")) cat = "mustakil-ev";
  else if (t.includes("dukkan")) cat = "dukkan-magaza";
  else if (t.includes("ofis")) cat = "ofis-is-yeri";
  let url = `https://www.sahibinden.com/${type === "SALE" ? "satilik" : "kiralik"}-${cat}/${citySlug}`;
  const firstWord = normalize(title.split(" ")[0]);
  const slug = KONYA_DISTRICTS[firstWord];
  if (slug) url += `-${slug}`;
  return url;
}

// Kategori tahmini
async function guessCategory(title: string): Promise<string | null> {
  const t = normalize(title);
  const map: Record<string, string> = {
    villa: "villa", arsa: "arsa", tarla: "tarla", daire: "daire",
    mustakil: "mustakil-ev", dukkan: "dukkan", ofis: "ofis",
    kooperatif: "kooperatif", bina: "bina", depo: "depo", ciftlik: "ciftlik-evi",
  };
  for (const [k, v] of Object.entries(map)) {
    if (t.includes(k)) {
      const cat = await prisma.category.findUnique({ where: { slug: v } });
      return cat?.id || null;
    }
  }
  const daire = await prisma.category.findUnique({ where: { slug: "daire" } });
  return daire?.id || null;
}

// ---- Emlakjet Sayfası Parse ----

function parseListPage(html: string): string[] {
  const urls: string[] = [];
  const re = /href="(\/ilan\/[^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (!urls.includes(m[1])) urls.push(m[1]);
  }
  return urls;
}

interface ParsedListing {
  title: string;
  originalTitle: string;
  description: string;
  price: number | null;
  currency: string;
  district: string | null;
  neighborhood: string | null;
  roomCount: string | null;
  squareMeters: number | null;
  imageUrls: string[];
  sellerName: string | null;
  sellerPhone: string | null;
}

function parseDetailPage(html: string): ParsedListing | null {
  try {
    // JSON key-value
    const fields: Record<string, string> = {};
    const re = /"(\w+)"\s*:\s*"([^"]{1,1000})"/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      if (!fields[m[1]]) fields[m[1]] = m[2];
    }

    // Orijinal başlık
    const titleMatch = html.match(/<title>([^<]+)/);
    const originalTitle = titleMatch
      ? titleMatch[1].replace(/\s*\|.*$/, "").replace(/\s*#\d+$/, "").replace(/^Emlakjet\s*-?\s*/i, "").trim()
      : "";

    // Temiz başlık
    let title = originalTitle.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    title = title.replace(/\s+[\d,.]+\s*TL\s*$/i, "");
    const cities = ["Konya", "Ankara", "İstanbul", "İzmir", "Bursa", "Antalya"];
    for (const cn of cities) {
      const idx = title.indexOf(cn);
      if (idx > 0) { title = title.substring(idx); break; }
    }
    for (const cn of cities) title = title.replace(new RegExp(`^${cn}\\s+`), "");
    title = title.replace(/\s+Oda\s+/g, " ").replace(/Mahallesi/g, "Mah.").replace(/\s+/g, " ").trim();

    const description = fields.description || "";
    const price = fields.price ? parseInt(fields.price.replace(/[^0-9]/g, "")) : null;
    const currency = fields.priceCurrency === "USD" ? "USD" : fields.priceCurrency === "EUR" ? "EUR" : "TL";
    const district = fields.district ? fields.district.replace(/-/g, " ") : null;
    const neighborhood = fields.neighborhood ? fields.neighborhood.replace(/-/g, " ") : null;
    const roomMatch = (title + " " + description).match(/(\d\+[12])/);
    const sqmMatch = (title + " " + description).match(/(\d+)\s*m²/i);

    // Resimler
    const imageUrls: string[] = [];
    const imgRe = /https:\/\/imaj\.emlakjet\.com\/listing\/[^"'\s<>]+/g;
    while ((m = imgRe.exec(html)) !== null) {
      if (!imageUrls.includes(m[0])) imageUrls.push(m[0]);
    }

    // Telefon
    let sellerPhone: string | null = null;
    const phoneMatch = html.match(/"telephone"\s*:\s*"(\d{10,11})"/);
    if (phoneMatch) {
      sellerPhone = phoneMatch[1];
      if (sellerPhone.length === 10 && !sellerPhone.startsWith("0")) sellerPhone = "0" + sellerPhone;
    }

    // Satıcı adı
    let sellerName: string | null = "Sahibinden";
    const nameMatch = description.match(/^([^,]+?)(?:\s+\w+\s+Mah)/);
    if (nameMatch && nameMatch[1].length < 40) sellerName = nameMatch[1].trim();
    if (sellerName.toLowerCase() === "sahibinden") sellerName = "Sahibinden";

    if (!title && !description) return null;

    return {
      title, originalTitle, description: description.substring(0, 5000),
      price, currency, district, neighborhood,
      roomCount: roomMatch ? roomMatch[1] : null,
      squareMeters: sqmMatch ? parseInt(sqmMatch[1]) : null,
      imageUrls: imageUrls.slice(0, 20),
      sellerName, sellerPhone,
    };
  } catch {
    return null;
  }
}

// ---- Ana Bot Fonksiyonu ----

export async function runBot(
  citySlug: string,
  listingType: "SALE" | "RENT" = "SALE",
  maxPages: number = 5
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

  const typeSlug = listingType === "SALE" ? "satilik" : "kiralik";
  const categories = ["konut", "daire", "mustakil-ev", "arsa", "villa", "kooperatif", "ofis", "bina", "ciftlik-evi", "depo"];
  const allUrls: string[] = [];

  try {
    console.log(`\n=== EvSahip Bot: ${city.name} ${typeSlug} ===\n`);

    // 1. ADIM: Tüm sayfalarda ilan URL'lerini topla
    // sahibinden filtresi varsa ekle, yoksa tüm ilanlar
    const ownerFilter = process.env.ONLY_OWNER === "true" ? "/sahibinden" : "";

    for (const cat of categories) {
      for (let page = 1; page <= maxPages; page++) {
        const url = `https://www.emlakjet.com/${typeSlug}-${cat}/${citySlug}${ownerFilter}${page > 1 ? `?page=${page}` : ""}`;
        try {
          const resp = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
          if (!resp.ok) break;
          const html = await resp.text();
          if (html.includes("security verification") || html.includes("captcha")) break;
          const urls = parseListPage(html);
          if (urls.length === 0) break;
          const newUrls = urls.filter(u => !allUrls.includes(u));
          allUrls.push(...newUrls);
          console.log(`  ${typeSlug}-${cat} s.${page}: ${newUrls.length} yeni (toplam: ${allUrls.length})`);
          if (newUrls.length === 0) break;
          await randomDelay(1000, 2000);
        } catch { break; }
      }
    }

    result.totalFound = allUrls.length;
    console.log(`\n${allUrls.length} benzersiz ilan bulundu. Detaylar çekiliyor...\n`);

    // 2. ADIM: Her ilanın detayına gir
    for (const listingUrl of allUrls) {
      try {
        const idMatch = listingUrl.match(/(\d+)(?:\/?$)/);
        if (!idMatch) { result.errors++; continue; }
        const emlakjetId = `EJ${idMatch[1]}`;

        // Duplicate kontrolü
        const existing = await prisma.listing.findUnique({ where: { sahibindenId: emlakjetId } });
        if (existing) { result.duplicates++; continue; }

        await randomDelay();

        const resp = await fetch(`https://www.emlakjet.com${listingUrl}`, {
          headers: HEADERS, signal: AbortSignal.timeout(15000),
        });
        if (!resp.ok) { result.errors++; continue; }
        const html = await resp.text();
        const listing = parseDetailPage(html);
        if (!listing || !listing.title) { result.errors++; continue; }

        // BOT FİLTRE - agresif emlakçı tespiti
        const filter = botFilter(listing.description, listing.originalTitle, listing.sellerName);
        const categoryId = await guessCategory(listing.title);

        await prisma.listing.create({
          data: {
            sahibindenId: emlakjetId,
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
            buildingAge: null,
            floor: null,
            imageUrls: listing.imageUrls,
            sourceUrl: `https://www.emlakjet.com${listingUrl}`,
            sahibindenUrl: buildSbUrl(listing.title, listingType, citySlug),
            sellerName: listing.sellerName,
            sellerPhone: listing.sellerPhone,
            isFromOwner: filter.isOwner,
            rejectionReason: filter.reason,
            status: filter.isOwner ? "ACTIVE" : "PASSIVE",
            cityId: city.id,
            categoryId,
          },
        });

        if (filter.isOwner) {
          result.accepted++;
          const img = listing.imageUrls.length > 0 ? "📷" : "  ";
          console.log(`  ✓ ${img} ${listing.title.substring(0, 50)} | ${listing.price?.toLocaleString("tr-TR")} TL | ${listing.sellerPhone || "-"}`);
        } else {
          result.rejected++;
        }
      } catch (err) {
        console.error(`  Hata:`, err instanceof Error ? err.message : "");
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

    console.log(`\n=== Sonuç: ${result.accepted} kabul | ${result.rejected} red | ${result.duplicates} dup | ${result.errors} hata | ${(result.duration / 1000).toFixed(0)}s ===\n`);
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
