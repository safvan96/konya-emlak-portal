/**
 * Emlakjet ilanlarının başlıklarını temizler.
 * Format: "SatıcıAdı Konya İlçe Mah OdaSayısı Tip Fiyat TL" → "İlçe Mah OdaSayısı Tip"
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function cleanTitle(title: string): string {
  let clean = title;

  // HTML entities
  clean = clean.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

  // Sondaki fiyatı kaldır: "... 6,000,000 TL" veya "... 800,000 TL"
  clean = clean.replace(/\s+[\d,.]+\s*TL\s*$/i, "");

  // Şehir adından önceki satıcı adını kaldır (tüm şehirler)
  const cities = ["Konya", "Ankara", "İstanbul", "İzmir", "Bursa", "Antalya", "Adana", "Gaziantep", "Kayseri", "Mersin"];
  for (const city of cities) {
    const cityIdx = clean.indexOf(city);
    if (cityIdx > 0) {
      clean = clean.substring(cityIdx);
      break;
    }
  }

  // Şehir adını kaldır, sadece ilçe+mahalle+detay bırak
  for (const city of cities) {
    clean = clean.replace(new RegExp(`^${city}\\s+`), "");
  }

  // "Oda" kelimesini kaldır (gereksiz)
  clean = clean.replace(/\s+Oda\s+/g, " ");

  // "Mahallesi" → "Mah."
  clean = clean.replace(/Mahallesi/g, "Mah.");

  // Fazla boşlukları temizle
  clean = clean.replace(/\s+/g, " ").trim();

  // Çok kısaysa orijinali dön
  if (clean.length < 10) return title;

  return clean;
}

async function main() {
  const listings = await prisma.listing.findMany({
    where: { sourceUrl: { contains: "emlakjet" } },
    select: { id: true, title: true },
  });

  console.log(`${listings.length} Emlakjet ilanı temizleniyor...\n`);

  let changed = 0;
  for (const listing of listings) {
    const newTitle = cleanTitle(listing.title);
    if (newTitle !== listing.title) {
      await prisma.listing.update({
        where: { id: listing.id },
        data: { title: newTitle },
      });
      changed++;
      if (changed <= 10) {
        console.log(`  Eski: ${listing.title.substring(0, 70)}`);
        console.log(`  Yeni: ${newTitle.substring(0, 70)}`);
        console.log();
      }
    }
  }

  console.log(`Toplam temizlenen: ${changed}/${listings.length}`);
  await prisma.$disconnect();
}

main();
