import { prisma } from "../prisma";

// Varsayılan blacklist - DB'den de yüklenir
const DEFAULT_BLACKLIST = [
  "emlak danışmanı",
  "gayrimenkul danışmanı",
  "remax",
  "re/max",
  "century 21",
  "coldwell banker",
  "keller williams",
  "emlak ofisi",
  "gayrimenkul ofisi",
  "portföy no",
  "portföy numarası",
  "danışmanınız",
  "emlak müşaviri",
  "gayrimenkul yatırım danışmanı",
  "turyap",
  "emlak konut",
  "franchise",
  "ofisimiz",
  "şubemiz",
  "mağazamız",
  "profesyonel ekibimiz",
  "gayrimenkul firması",
  "emlak firması",
  "broker",
  "portföyümüz",
  "hizmet veriyoruz",
  "danışmanlık hizmeti",
  "referans no",
  "ilan no:",
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
      return dbKeywords.map((k) => k.keyword);
    }
  } catch {
    // DB bağlantısı yoksa default kullan
  }
  return DEFAULT_BLACKLIST;
}

export async function filterListing(
  description: string,
  sellerName?: string,
  title?: string
): Promise<FilterResult> {
  const blacklist = await getBlacklistKeywords();
  const lowerDesc = description.toLowerCase();
  const lowerSeller = (sellerName || "").toLowerCase();
  const lowerTitle = (title || "").toLowerCase();
  const matchedKeywords: string[] = [];

  // 1. Açıklama içinde blacklist kelime kontrolü
  for (const keyword of blacklist) {
    if (lowerDesc.includes(keyword.toLowerCase())) {
      matchedKeywords.push(keyword);
    }
  }

  // 2. Satıcı adı kontrolü
  const agentNamePatterns = [
    /emlak/i,
    /gayrimenkul/i,
    /remax/i,
    /re\/max/i,
    /century/i,
    /coldwell/i,
    /turyap/i,
    /keller/i,
    /danışman/i,
    /consultant/i,
    /estate/i,
    /realty/i,
  ];

  for (const pattern of agentNamePatterns) {
    if (pattern.test(lowerSeller)) {
      matchedKeywords.push(`satıcı adı: ${sellerName}`);
    }
  }

  // 2b. Başlıkta emlakçı/gayrimenkul ofisi ismi kontrolü
  // Emlakjet gibi sitelerde satıcı adı başlığa dahil edilir
  if (lowerTitle) {
    // "Sahibinden" kelimesi varsa → gerçek sahip olma ihtimali yüksek, atla
    const isSahibinden = /\bsahibinden\b/i.test(lowerTitle);
    if (!isSahibinden) {
      const titleAgentPatterns = [
        /\bemlak\b/i,
        /\bgayrimenkul\b/i,
        /\bremax\b/i,
        /\bre\/max\b/i,
        /\bcentury\s*21\b/i,
        /\bcoldwell\b/i,
        /\bturyap\b/i,
        /\brealty\s*world\b/i,
        /\bkeller\s*williams\b/i,
      ];
      for (const pattern of titleAgentPatterns) {
        if (pattern.test(lowerTitle)) {
          matchedKeywords.push(`başlıkta emlakçı: ${title?.substring(0, 50)}`);
          break; // Bir eşleşme yeterli
        }
      }
    }
  }

  // 3. Telefon numarası tekrar pattern (açıklamada birden fazla farklı numara)
  const phonePattern = /0?\d{3}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/g;
  const phones = description.match(phonePattern);
  if (phones && phones.length >= 3) {
    matchedKeywords.push("çoklu telefon numarası (muhtemelen emlakçı)");
  }

  // 4. Web sitesi/URL pattern (emlakçılar genellikle site linki koyar)
  const urlPattern = /(?:www\.|https?:\/\/)[\w.-]+\.(?:com|net|org|com\.tr)/gi;
  const urls = description.match(urlPattern);
  if (urls && urls.length > 0) {
    // Sahibinden kendi URL'lerini hariç tut
    const externalUrls = urls.filter((u) => !u.includes("sahibinden"));
    if (externalUrls.length > 0) {
      matchedKeywords.push(`harici web sitesi: ${externalUrls[0]}`);
    }
  }

  // 4. "Detaylı bilgi için" + telefon pattern
  if (/detaylı bilgi için.*(?:arayın|ulaşın|iletişim)/i.test(description)) {
    // Bu pattern emlakçılara özgü değil, ama diğer sinyallerle birlikte anlamlı
    if (matchedKeywords.length > 0) {
      matchedKeywords.push("detaylı bilgi yönlendirmesi");
    }
  }

  if (matchedKeywords.length > 0) {
    return {
      isFromOwner: false,
      rejectionReason: `Emlakçı tespiti: ${matchedKeywords.join(", ")}`,
      matchedKeywords,
    };
  }

  return {
    isFromOwner: true,
    rejectionReason: null,
    matchedKeywords: [],
  };
}
