/**
 * Sahibinden ilanlarını JSON dosyasından import eder.
 * sahibinden-collector.html ile toplanan ilanları DB'ye aktarır.
 *
 * Kullanım: npx tsx scripts/import-sahibinden.ts sahibinden_ilanlar.json
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";

const prisma = new PrismaClient();

interface SbListing {
  title: string;
  description: string;
  price: number | null;
  location: string;
  roomCount: string | null;
  squareMeters: number | null;
  phone: string | null;
  source: string;
  sourceUrl: string;
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Kullanım: npx tsx scripts/import-sahibinden.ts <dosya.json>");
    process.exit(1);
  }

  const data: SbListing[] = JSON.parse(fs.readFileSync(file, "utf8"));
  console.log(`${data.length} ilan import ediliyor...\n`);

  const city = await prisma.city.findUnique({ where: { slug: "konya" } });
  if (!city) { console.error("Konya bulunamadı"); process.exit(1); }

  let imported = 0, skipped = 0;

  for (const item of data) {
    // Duplicate kontrolü
    const existing = await prisma.listing.findFirst({
      where: { title: item.title, price: item.price },
    });
    if (existing) { skipped++; continue; }

    // Kategori tahmini
    const t = item.title.toLowerCase();
    let catSlug = "daire";
    if (t.includes("arsa") || t.includes("tarla")) catSlug = "arsa";
    else if (t.includes("villa")) catSlug = "villa";
    else if (t.includes("müstakil") || t.includes("mustakil")) catSlug = "mustakil-ev";
    const cat = await prisma.category.findUnique({ where: { slug: catSlug } });

    // İlçe çıkar
    const distMatch = item.location?.match(/Konya[,\s]+(\w+)/);
    const district = distMatch ? distMatch[1] : null;

    const id = `SB${Date.now()}${Math.random().toString(36).slice(2, 6)}`;

    await prisma.listing.create({
      data: {
        sahibindenId: id,
        title: item.title,
        description: item.description || "",
        price: item.price,
        currency: "TL",
        listingType: t.includes("kiralık") || t.includes("kiralik") ? "RENT" : "SALE",
        location: item.location || "Konya",
        district,
        roomCount: item.roomCount,
        squareMeters: item.squareMeters,
        imageUrls: [],
        sourceUrl: item.sourceUrl || "https://www.sahibinden.com",
        sellerName: "Sahibinden",
        sellerPhone: item.phone,
        isFromOwner: true,
        status: "ACTIVE",
        cityId: city.id,
        categoryId: cat?.id || null,
      },
    });

    imported++;
    console.log(`  ✓ ${item.title.substring(0, 50)} | ${item.price?.toLocaleString("tr-TR")} TL | ${item.phone || "-"}`);
  }

  console.log(`\nImport: ${imported} eklendi, ${skipped} atlandı (duplicate)`);
  await prisma.$disconnect();
}

main();
