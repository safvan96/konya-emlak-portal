import { prisma } from "../prisma";

/**
 * Emlakçı filtresi.
 *
 * Emlakjet'de çoğu ilan emlakçılardan geliyor. "Sahibinden" etiketi olan
 * veya açıklamada emlakçı sinyali OLMAYAN ilanlar kabul edilir.
 *
 * Strateji: Emlakjet'de satıcı tipi "Sahibinden" olanları kabul et,
 * diğerlerini reddet.
 */

// Kesin emlakçı kelimeleri - bunlardan biri varsa KESİN RED
const HARD_REJECT = [
  "emlak ofisi",
  "gayrimenkul ofisi",
  "emlak danışmanı",
  "gayrimenkul danışmanı",
  "remax",
  "re/max",
  "century 21",
  "coldwell banker",
  "keller williams",
  "turyap",
  "realty world",
  "portföy no",
  "portföy numarası",
  "referans no",
  "ilan no:",
  "franchise",
  "ofisimiz",
  "şubemiz",
  "profesyonel ekibimiz",
  "danışmanlık hizmeti",
  "hizmet veriyoruz",
  "portföyümüz",
];

export interface FilterResult {
  isFromOwner: boolean;
  rejectionReason: string | null;
  matchedKeywords: string[];
}

export async function getBlacklistKeywords(): Promise<string[]> {
  try {
    const dbKeywords = await prisma.blacklistKeyword.findMany();
    if (dbKeywords.length > 0) {
      return [...HARD_REJECT, ...dbKeywords.map((k) => k.keyword)];
    }
  } catch {
    // DB bağlantısı yoksa default kullan
  }
  return HARD_REJECT;
}

export async function filterListing(
  description: string,
  sellerName?: string,
  title?: string
): Promise<FilterResult> {
  const blacklist = await getBlacklistKeywords();
  // Türkçe karakter normalizasyonu - emlakçı tespiti için
  const rawText = [description, sellerName, title].filter(Boolean).join(" ");
  const trMap: Record<string, string> = {
    "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u",
    "Ç": "c", "Ğ": "g", "İ": "i", "Ö": "o", "Ş": "s", "Ü": "u",
  };
  const fullText = rawText
    .replace(/[^\x00-\x7F]/g, (c) => trMap[c] || "")
    .toLowerCase();
  const matchedKeywords: string[] = [];

  // 1. Kesin emlakçı kelime kontrolü
  for (const keyword of blacklist) {
    if (fullText.includes(keyword.toLowerCase())) {
      matchedKeywords.push(keyword);
    }
  }

  // 2. Orijinal başlıkta emlakçı firma adı kontrolü
  // "Xyz Emlak", "Xyz Gayrimenkul" pattern - başlığın başında firma adı var
  if (title) {
    const t = title.toLowerCase();
    // "Xxx Emlak Konya..." veya "Xxx Gayrimenkul Konya..." pattern
    if (/\bemlak\b/i.test(t) && !/\bsahibinden\b/i.test(t)) {
      matchedKeywords.push(`başlıkta emlak: ${title.substring(0, 40)}`);
    }
    if (/\bgayrimenkul\b/i.test(t) && !/\bsahibinden\b/i.test(t)) {
      matchedKeywords.push(`başlıkta gayrimenkul: ${title.substring(0, 40)}`);
    }
  }

  // 3. Açıklamada firma adı pattern: "Xyz Emlak ... konumunda" (emlakjet format)
  const descNormalized = fullText; // zaten normalize edilmiş
  if (/^[a-zçğıöşü\s&.]+(?:emlak|gayrimenkul)[^,]*konumunda/i.test(descNormalized)) {
    // "Sahibinden ... konumunda" pattern'i kabul et
    if (!/^sahibinden\s/i.test(descNormalized)) {
      matchedKeywords.push("emlakçı açıklama formatı");
    }
  }

  // 3b. Açıklamada tek başına "emlak" veya "gayrimenkul" kelimesi (firma adı olarak)
  // "Xxx Emlak" veya "Xxx Gayrimenkul" - açıklamanın ilk 50 karakterinde
  const descFirst50 = descNormalized.substring(0, 50);
  if (/\bemlak\b/.test(descFirst50) && !/sahibinden/.test(descFirst50)) {
    matchedKeywords.push("açıklamada emlak firma adı");
  }
  if (/gayrimenkul/.test(descFirst50) && !/sahibinden/.test(descFirst50)) {
    matchedKeywords.push("açıklamada gayrimenkul firma adı");
  }

  // 4. Çoklu telefon numarası (3+)
  const phonePattern = /0?\d{3}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/g;
  const phones = description.match(phonePattern);
  if (phones && phones.length >= 3) {
    matchedKeywords.push(`${phones.length} telefon numarası`);
  }

  // 5. Harici web sitesi
  const urlPattern = /(?:www\.|https?:\/\/)[\w.-]+\.(?:com|net|org|com\.tr)/gi;
  const urls = description.match(urlPattern);
  if (urls) {
    const externalUrls = urls.filter((u) => !u.includes("sahibinden") && !u.includes("emlakjet"));
    if (externalUrls.length > 0) {
      matchedKeywords.push(`harici site: ${externalUrls[0]}`);
    }
  }

  if (matchedKeywords.length > 0) {
    return {
      isFromOwner: false,
      rejectionReason: `Emlakçı tespiti: ${matchedKeywords.slice(0, 5).join(", ")}`,
      matchedKeywords,
    };
  }

  return {
    isFromOwner: true,
    rejectionReason: null,
    matchedKeywords: [],
  };
}
