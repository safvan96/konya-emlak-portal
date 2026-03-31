import { runBot } from "../src/lib/scraper/bot";
import { autoAssignListings } from "../src/lib/auto-assign";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Eski ilanları temizle
  console.log("DB temizleniyor...");
  await prisma.assignment.deleteMany({});
  await prisma.favorite.deleteMany({});
  await prisma.priceHistory.deleteMany({});
  await prisma.listing.deleteMany({});
  await prisma.scraperRun.deleteMany({});
  console.log("Temiz!\n");

  // Bot çalıştır
  const sale = await runBot("konya", "SALE", 5);
  const rent = await runBot("konya", "RENT", 5);

  console.log("=== TOPLAM ===");
  console.log(`Gerçek sahip: ${sale.accepted + rent.accepted}`);
  console.log(`Emlakçı RED: ${sale.rejected + rent.rejected}`);
  console.log(`Süre: ${((sale.duration + rent.duration) / 1000 / 60).toFixed(1)} dk`);

  // Otomatik atama
  console.log("\nOtomatik atama...");
  await autoAssignListings();

  // Final stats
  const total = await prisma.listing.count({ where: { isFromOwner: true } });
  const withPhone = await prisma.listing.count({ where: { isFromOwner: true, sellerPhone: { not: null } } });
  const withImg = await prisma.listing.count({ where: { isFromOwner: true, imageUrls: { isEmpty: false } } });
  console.log(`\nFinal: ${total} ilan | ${withPhone} telefonlu | ${withImg} fotoğraflı`);

  await prisma.$disconnect();
  process.exit(0);
}

main();
