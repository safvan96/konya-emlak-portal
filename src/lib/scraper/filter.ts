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

// Bilinen Konya firmaları / inşaatçıları (zamanla büyür)
// Not: Bunlar sahip ilanlarında geçmesi çok olası olmayan özel isimler.
const KNOWN_FIRMS = [
  "sefergyo",
  "naşal",
  "nasal",
  "süşen",
  "susen",
  "sürşen",
  "sursen",
];

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
  // İnşaat/yapı firması sinyalleri (title/description analizinde daha detaylı kontrol var)
  "premium group",
  "konut a.ş",
  "konut a.s",
  "yapi ltd",
  "yapı ltd",
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

  // 1b. Bilinen Konya firmaları
  for (const firm of KNOWN_FIRMS) {
    if (fullText.includes(firm)) {
      matchedKeywords.push(`bilinen firma: ${firm}`);
    }
  }

  // 2. Orijinal başlıkta emlakçı firma adı kontrolü
  // "Xyz Emlak", "Xyz Gayrimenkul" pattern - başlığın başında firma adı var
  if (title) {
    // Türkçe normalize edilmiş title (İ→i, ş→s, vb.) - JS'nin toLowerCase() İ→i̇ (combining)
    // yapıyor ve regex'leri bozuyor. trMap ile önce ASCII'leştir.
    const t = title.replace(/[^\x00-\x7F]/g, (c) => trMap[c] || "").toLowerCase();
    // "Xxx Emlak Konya..." veya "Xxx Gayrimenkul Konya..." pattern
    // "emlak" veya "emlak-compound" (emlakyap, emlakten)
    if (/\bemlak[a-zçğıöşü]*\b/i.test(t) && !/\bsahibinden\b/i.test(t) && !/\bemlakjet\b/i.test(t)) {
      matchedKeywords.push(`başlıkta emlak: ${title.substring(0, 40)}`);
    }
    // "gayrimenkul" veya "gayrimenkulden/dan" (compound suffix)
    if (/\bgayrimenkul[a-zçğıöşü]*\b/i.test(t) && !/\bsahibinden\b/i.test(t)) {
      matchedKeywords.push(`başlıkta gayrimenkul: ${title.substring(0, 40)}`);
    }
    // Firma + Türkçe ablatif ek pattern: "NOVAYAPI'DAN", "CANCAN'DAN", "RSM'den"
    // "X'DAN/X'DEN" — kesme işaretli ablatif. Negative lookahead (underscore ve benzeri için).
    // Space'li varyant da: "NURKA' dan", "ALTIN EMLAK' TAN"
    const apostropheAblative = title.match(/([A-ZÇĞİÖŞÜa-zçğıöşü]{3,})[''][\s]*(DAN|DEN|TAN|TEN|dan|den|tan|ten)(?![a-zA-ZçğıöşüÇĞİÖŞÜ])/);
    if (apostropheAblative) {
      matchedKeywords.push(`firma ablatif: ${apostropheAblative[1]}'${apostropheAblative[2]}`);
    }
    // 2-kelime CAPS + ablatif (boşluklu): "YÜKSEL ŞAHİN DEN", "KENT EMLAK DAN"
    // Tek kelime (KONYA DAN) riskli, 2 kelime çok daha güvenli firma sinyali.
    if (/\b[A-ZÇĞİÖŞÜ]{3,}\s+[A-ZÇĞİÖŞÜ]{3,}\s+(DAN|DEN|TAN|TEN)(?![a-zA-ZçğıöşüÇĞİÖŞÜ])/.test(title)) {
      matchedKeywords.push(`2-kelime CAPS ablatif`);
    }
    // İnşaat/holding/group — kelime sınırlarıyla
    if (/\b(holding|group)\b/i.test(t)) {
      matchedKeywords.push(`başlıkta holding/group`);
    }
    if (/\bi̇?nşaat['']?(tan|ten)?\b/i.test(t) || /\binsaat['']?(tan|ten)?\b/i.test(t)) {
      matchedKeywords.push(`başlıkta inşaat`);
    }
    // "X müteahhit(lik)" firma kalıbı: "ABC Müteahhitlik", "XYZ Müteahhit"
    if (/\b(müteahhitlik|muteahhitlik)\b/i.test(t)) {
      matchedKeywords.push(`başlıkta müteahhitlik`);
    }
    // "yapı kooperatif" / "yapi kooperatif" (firma kalıbı)
    if (/\byap[ıi]\s+kooperatif/i.test(t)) {
      matchedKeywords.push(`başlıkta yapı kooperatifi`);
    }
  }

  // 2b. Açıklamada "müteahhit firma" / "müteahhitlik" kalıbı
  if (/muteahhitlik|muteahhit firma|muteahhit ofis/.test(fullText)) {
    matchedKeywords.push("açıklamada müteahhitlik firması");
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

  // 3c. Birleşik "emlak*" firma adı: "Emlakyap", "Emlaknomi", "Emlakon", "KENT EMLAKTAN" vb.
  // "emlak" + en az 2 harf, ama "emlakjet"/"emlaknet" (site adları) hariç.
  // Ayrıca "emlakci/emlakcı" gibi sahip ilanlarında geçen "emlakçı aracı olmasın" gibi meşru ifadeleri
  // yakalamamak için, kelime başında veya url-benzeri bağlamda olanları ayırt edelim.
  const emlakCompoundRe = /\bemlak(?!jet\b|net\b|ci\b|cı\b)[a-zçğıöşü]{2,}\b/gi;
  const titleForCompound = (title || "").toLowerCase();
  const searchText = titleForCompound + " " + descNormalized.substring(0, 200);
  const compoundMatches = searchText.match(emlakCompoundRe);
  if (compoundMatches && compoundMatches.length > 0) {
    matchedKeywords.push(`emlak-compound firma: ${compoundMatches[0]}`);
  }
  // URL alan adı kontrolü: "emlakyap-tan-satilik" gibi URL slug
  // Not: filterListing'e URL geçilmiyor, ama title/desc'te slug fragment'ı olabilir
  if (/emlak(?!jet|net)[a-zçğıöşü]{2,}[-'][td]?[ae]n/i.test(searchText)) {
    matchedKeywords.push("emlak-firma ablatif slug");
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
