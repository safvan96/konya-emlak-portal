/**
 * Tüm ilanlara sahibinden.com arama linki ekler.
 * İlanın ilçe, oda sayısı ve tipine göre sahibinden'de arama URL'si oluşturur.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Konya ilçe slug'ları (sahibinden format)
const districtSlugs: Record<string, string> = {
  "selcuklu": "selcuklu",
  "selçuklu": "selcuklu",
  "meram": "meram",
  "karatay": "karatay",
  "beyşehir": "beysehir",
  "beysehir": "beysehir",
  "akşehir": "aksehir",
  "aksehir": "aksehir",
  "ereğli": "eregli",
  "eregli": "eregli",
  "seydişehir": "seydisehir",
  "seydisehir": "seydisehir",
  "cihanbeyli": "cihanbeyli",
  "çumra": "cumra",
  "cumra": "cumra",
  "ilgın": "ilgin",
  "ilgin": "ilgin",
  "kulu": "kulu",
  "bozkır": "bozkir",
  "bozkir": "bozkir",
  "hadim": "hadim",
  "sarayönü": "sarayonu",
  "sarayonu": "sarayonu",
  "derebucak": "derebucak",
  "emirgazi": "emirgazi",
  "akören": "akoren",
  "akoren": "akoren",
  "elmadağ": "elmadag",
  "yenimahalle": "yenimahalle",
  "gölbaşı": "golbasi",
  "golbasi": "golbasi",
};

function buildSahibindenUrl(listing: {
  listingType: string;
  district: string | null;
  roomCount: string | null;
  title: string;
}): string {
  const type = listing.listingType === "SALE" ? "satilik" : "kiralik";

  // Kategori tespiti
  let category = "";
  const titleLower = listing.title.toLowerCase();
  if (titleLower.includes("arsa") || titleLower.includes("tarla")) {
    category = "arsa";
  } else if (titleLower.includes("villa")) {
    category = "villa";
  } else if (titleLower.includes("müstakil") || titleLower.includes("mustakil")) {
    category = "mustakil-ev";
  } else if (titleLower.includes("dükkan") || titleLower.includes("dukkan")) {
    category = "dukkan-magaza";
  } else if (titleLower.includes("ofis")) {
    category = "ofis-is-yeri";
  } else if (titleLower.includes("depo")) {
    category = "depo-antrepo";
  } else if (titleLower.includes("bina")) {
    category = "bina";
  } else {
    category = "daire";
  }

  // Temel URL
  let url = `https://www.sahibinden.com/${type}-${category}/konya`;

  // İlçe ekle
  if (listing.district) {
    const distLower = listing.district.toLowerCase().trim();
    const slug = districtSlugs[distLower];
    if (slug) {
      url += `-${slug}`;
    }
  }

  return url;
}

async function main() {
  const listings = await prisma.listing.findMany({
    where: { city: { slug: "konya" } },
    select: { id: true, title: true, listingType: true, district: true, roomCount: true, sahibindenUrl: true },
  });

  console.log(`${listings.length} Konya ilanına sahibinden linki ekleniyor...\n`);

  let updated = 0;
  for (const listing of listings) {
    const sbUrl = buildSahibindenUrl(listing);

    if (listing.sahibindenUrl !== sbUrl) {
      await prisma.listing.update({
        where: { id: listing.id },
        data: { sahibindenUrl: sbUrl },
      });
      updated++;
      if (updated <= 10) {
        console.log(`  ${listing.title.substring(0, 50)}`);
        console.log(`  → ${sbUrl}`);
        console.log();
      }
    }
  }

  console.log(`Toplam güncellenen: ${updated}/${listings.length}`);
  await prisma.$disconnect();
}

main();
