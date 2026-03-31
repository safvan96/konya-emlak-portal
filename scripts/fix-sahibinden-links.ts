/**
 * Sahibinden linklerini başlıktaki ilçe adına göre düzeltir.
 * Başlık formatı: "Selçuklu Bosna Hersek Mah. 3+1 Satılık Daire"
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Konya ilçeleri → sahibinden slug
const KONYA_DISTRICTS: Record<string, string> = {
  "selçuklu": "selcuklu", "selcuklu": "selcuklu",
  "meram": "meram",
  "karatay": "karatay",
  "beyşehir": "beysehir", "beysehir": "beysehir",
  "akşehir": "aksehir", "aksehir": "aksehir",
  "ereğli": "eregli", "eregli": "eregli",
  "seydişehir": "seydisehir", "seydisehir": "seydisehir",
  "cihanbeyli": "cihanbeyli",
  "çumra": "cumra", "cumra": "cumra",
  "ilgın": "ilgin", "ilgin": "ilgin",
  "kulu": "kulu",
  "bozkır": "bozkir", "bozkir": "bozkir",
  "hadim": "hadim",
  "sarayönü": "sarayonu", "sarayonu": "sarayonu",
  "derebucak": "derebucak",
  "emirgazi": "emirgazi",
  "akören": "akoren", "akoren": "akoren",
  "halkapınar": "halkapinar", "halkapinar": "halkapinar",
  "altınekin": "altinekin", "altinekin": "altinekin",
  "tuzlukçu": "tuzlukcu", "tuzlukcu": "tuzlukcu",
  "yunak": "yunak",
  "kadınhanı": "kadinhani", "kadinhani": "kadinhani",
  "doğanhisar": "doganhisar",
  "hüyük": "huyuk", "huyuk": "huyuk",
  "güneysınır": "guneysinir",
  "taşkent": "taskent", "taskent": "taskent",
  "ahırlı": "ahirli", "ahirli": "ahirli",
  "yalıhüyük": "yalihuyuk",
  "derbent": "derbent",
  "çeltik": "celtik", "celtik": "celtik",
};

function buildLink(title: string, listingType: string): string {
  const type = listingType === "SALE" ? "satilik" : "kiralik";
  const t = title.toLowerCase();

  // Kategori
  let cat = "daire";
  if (t.includes("arsa") || t.includes("tarla") || t.includes("imarlı") || t.includes("imarli") || t.includes("bağ")) cat = "arsa";
  else if (t.includes("villa")) cat = "villa";
  else if (t.includes("müstakil") || t.includes("mustakil") || t.includes("köy evi") || t.includes("çiftlik")) cat = "mustakil-ev";
  else if (t.includes("dükkan") || t.includes("dukkan")) cat = "dukkan-magaza";
  else if (t.includes("ofis")) cat = "ofis-is-yeri";
  else if (t.includes("depo")) cat = "depo-antrepo";

  // İlçe - başlığın ilk kelimesi
  let url = `https://www.sahibinden.com/${type}-${cat}/konya`;
  const firstWord = title.split(" ")[0].toLowerCase();
  const slug = KONYA_DISTRICTS[firstWord];
  if (slug) {
    url += `-${slug}`;
  }

  return url;
}

async function main() {
  const listings = await prisma.listing.findMany({
    select: { id: true, title: true, listingType: true, sahibindenUrl: true },
  });

  console.log(`${listings.length} ilan güncelleniyor...\n`);

  let updated = 0;
  for (const l of listings) {
    const newUrl = buildLink(l.title, l.listingType);
    if (newUrl !== l.sahibindenUrl) {
      await prisma.listing.update({
        where: { id: l.id },
        data: { sahibindenUrl: newUrl },
      });
      updated++;
      if (updated <= 10) {
        console.log(`  ${l.title}`);
        console.log(`  → ${newUrl}\n`);
      }
    }
  }

  console.log(`Güncellenen: ${updated}/${listings.length}`);
  await prisma.$disconnect();
}

main();
