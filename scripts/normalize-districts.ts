/**
 * District field normalization.
 * Konya'nın 31 ilçesini canonical isimlerle eşle.
 * Tanınmayan değerler (mahalle adları vb.) null'a set edilir.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Konya ilçelerinin ASCII lowercase → canonical Türkçe eşlemesi
const DISTRICT_CANONICAL: Record<string, string> = {
  // Merkez ilçeler
  selcuklu: "Selçuklu",
  meram: "Meram",
  karatay: "Karatay",
  // Büyük ilçeler
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
  // Orta-küçük ilçeler
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

async function main() {
  const listings = await prisma.listing.findMany({
    where: { district: { not: null } },
    select: { id: true, district: true, location: true, title: true },
  });
  console.log(`${listings.length} district-li ilan kontrol ediliyor...\n`);

  let normalized = 0;
  let cleared = 0;
  const unrecognized: Record<string, number> = {};

  for (const l of listings) {
    if (!l.district) continue;
    const key = normalize(l.district);

    // Eğer canonical eşlemesi varsa, canonical'a dönüştür
    if (DISTRICT_CANONICAL[key]) {
      const canonical = DISTRICT_CANONICAL[key];
      if (canonical !== l.district) {
        await prisma.listing.update({
          where: { id: l.id },
          data: { district: canonical },
        });
        normalized++;
      }
      continue;
    }

    // Tanınmayan değer — location field'dan district tespit etmeyi dene
    let foundFromLocation: string | null = null;
    if (l.location) {
      const locNorm = normalize(l.location);
      for (const [asciiKey, canonical] of Object.entries(DISTRICT_CANONICAL)) {
        if (locNorm.includes(asciiKey)) {
          foundFromLocation = canonical;
          break;
        }
      }
    }

    if (foundFromLocation) {
      await prisma.listing.update({
        where: { id: l.id },
        data: { district: foundFromLocation },
      });
      normalized++;
    } else {
      // Tanınmayan ve bulunamayan → null
      await prisma.listing.update({
        where: { id: l.id },
        data: { district: null },
      });
      cleared++;
      unrecognized[l.district] = (unrecognized[l.district] || 0) + 1;
    }
  }

  console.log(`=== Sonuç ===`);
  console.log(`Canonical'a dönüştürülen: ${normalized}`);
  console.log(`Tanınmayan (null'a set): ${cleared}`);
  console.log(`\nEn çok görülen tanınmayan değerler:`);
  Object.entries(unrecognized)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([k, v]) => console.log(`  "${k}": ${v}`));

  // Final dağılım
  const final = await prisma.$queryRaw<Array<{ d: string; c: bigint }>>`
    SELECT COALESCE(district, '(null)') as d, COUNT(*) as c
    FROM listings
    GROUP BY d
    ORDER BY c DESC
    LIMIT 20
  `;
  console.log(`\nGüncel district dağılımı:`);
  final.forEach((r) => console.log(`  ${r.d}: ${r.c.toString()}`));

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
