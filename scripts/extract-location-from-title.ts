/**
 * Title'dan district ve neighborhood çıkar.
 *
 * Format: "{District} {Mahalle} Mah. {...} Satılık/Kiralık {...}"
 * Örnek:
 *   "Selçuklu Bosna Hersek Mah. 2+1 Satılık Daire"
 *   → district: "Selçuklu", neighborhood: "Bosna Hersek"
 *
 *   "Ereğli Orhaniye Mah. 1+1 Satılık Daire"
 *   → district: "Ereğli", neighborhood: "Orhaniye"
 *
 *   "Meram Alakova Mah. 2+1 Satılık Daire"
 *   → district: "Meram", neighborhood: "Alakova"
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CANONICAL_DISTRICTS: Record<string, string> = {
  selcuklu: "Selçuklu",
  meram: "Meram",
  karatay: "Karatay",
  eregli: "Ereğli",
  aksehir: "Akşehir",
  beysehir: "Beyşehir",
  seydisehir: "Seydişehir",
  ilgin: "Ilgın",
  cihanbeyli: "Cihanbeyli",
  kulu: "Kulu",
  cumra: "Çumra",
  kadinhani: "Kadınhanı",
  sarayonu: "Sarayönü",
  bozkir: "Bozkır",
  akoren: "Akören",
  altinekin: "Altınekin",
  derbent: "Derbent",
  derebucak: "Derebucak",
  doganhisar: "Doğanhisar",
  emirgazi: "Emirgazi",
  guneysinir: "Güneysınır",
  hadim: "Hadim",
  halkapinar: "Halkapınar",
  huyuk: "Hüyük",
  karapinar: "Karapınar",
  taskent: "Taşkent",
  tuzlukcu: "Tuzlukçu",
  yalihuyuk: "Yalıhüyük",
  yunak: "Yunak",
  celtik: "Çeltik",
};

function normalize(s: string): string {
  const map: Record<string, string> = {
    "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u",
    "Ç": "c", "Ğ": "g", "İ": "i", "Ö": "o", "Ş": "s", "Ü": "u",
  };
  return s.replace(/[^\x00-\x7F]/g, (c) => map[c] || "").toLowerCase().trim();
}

function extractLocation(title: string): { district: string | null; neighborhood: string | null } {
  // District: Title'ın ilk kelimesi (veya ilk 2 kelime) canonical ilçe mi?
  const normTitle = normalize(title);
  let district: string | null = null;

  // İlk kelime tek başına
  const firstWord = normTitle.split(/\s+/)[0];
  if (CANONICAL_DISTRICTS[firstWord]) {
    district = CANONICAL_DISTRICTS[firstWord];
  }

  // Neighborhood: "X Mah." veya "X Mahallesi" pattern
  // Mah kelimesi öncesi 1-3 kelime (Türkçe karakterli original title üzerinde)
  const mahMatch = title.match(/([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+){0,2})\s+Mah(?:\.|allesi)?/);
  let neighborhood: string | null = null;
  if (mahMatch) {
    neighborhood = mahMatch[1].trim();
    // Eğer ilk kelime district ise, ondan sonrasını al
    if (district && neighborhood.startsWith(district)) {
      neighborhood = neighborhood.slice(district.length).trim() || null;
    }
  }

  return { district, neighborhood };
}

async function main() {
  const listings = await prisma.listing.findMany({
    select: { id: true, title: true, district: true, neighborhood: true },
  });
  console.log(`${listings.length} ilan işleniyor...\n`);

  let districtUpdates = 0;
  let neighborhoodUpdates = 0;

  for (const l of listings) {
    if (!l.title) continue;
    const { district, neighborhood } = extractLocation(l.title);

    const updateData: { district?: string; neighborhood?: string } = {};
    if (district && district !== l.district) {
      updateData.district = district;
      districtUpdates++;
    }
    if (neighborhood && neighborhood !== l.neighborhood) {
      updateData.neighborhood = neighborhood;
      neighborhoodUpdates++;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.listing.update({
        where: { id: l.id },
        data: updateData,
      });
    }
  }

  console.log(`=== Sonuç ===`);
  console.log(`District güncelleme: ${districtUpdates}`);
  console.log(`Neighborhood güncelleme: ${neighborhoodUpdates}`);

  // Final district dağılımı
  const final = await prisma.$queryRaw<Array<{ d: string; c: bigint }>>`
    SELECT COALESCE(district, '(null)') as d, COUNT(*) as c
    FROM listings
    WHERE "isFromOwner" = true
    GROUP BY d
    ORDER BY c DESC
  `;
  console.log(`\nGüncel sahip ilanların district dağılımı:`);
  final.slice(0, 20).forEach((r) => console.log(`  ${r.d}: ${r.c.toString()}`));

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
