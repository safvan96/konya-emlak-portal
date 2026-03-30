/**
 * Mevcut ilanları tekrar filtreler.
 * Filtre kuralları güncellendikten sonra çalıştırılır.
 */
import { PrismaClient } from "@prisma/client";
import { filterListing } from "../src/lib/scraper/filter";

const prisma = new PrismaClient();

async function main() {
  const listings = await prisma.listing.findMany({
    select: { id: true, title: true, description: true, isFromOwner: true, status: true },
  });

  console.log(`${listings.length} ilan tekrar filtreleniyor...\n`);

  let changed = 0;
  let nowRejected = 0;
  let nowAccepted = 0;

  for (const listing of listings) {
    const result = await filterListing(listing.description, undefined, listing.title);

    if (result.isFromOwner !== listing.isFromOwner) {
      changed++;
      const newStatus = result.isFromOwner ? "ACTIVE" : "PASSIVE";
      await prisma.listing.update({
        where: { id: listing.id },
        data: {
          isFromOwner: result.isFromOwner,
          rejectionReason: result.rejectionReason,
          status: newStatus,
        },
      });

      if (!result.isFromOwner) {
        nowRejected++;
        console.log(`  ✗ → PASIF: ${listing.title.substring(0, 70)}`);
        console.log(`    Sebep: ${result.rejectionReason}`);
      } else {
        nowAccepted++;
        console.log(`  ✓ → AKTİF: ${listing.title.substring(0, 70)}`);
      }
    }
  }

  const stats = await prisma.listing.groupBy({
    by: ["isFromOwner"],
    _count: true,
  });

  console.log(`\n=== Sonuç ===`);
  console.log(`Değişen: ${changed} (${nowRejected} yeni red, ${nowAccepted} yeni kabul)`);
  console.log(`Güncel durum:`, stats.map(s => `${s.isFromOwner ? "Aktif" : "Pasif"}: ${s._count}`).join(", "));

  await prisma.$disconnect();
}

main();
