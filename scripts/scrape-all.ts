import { runBot } from "../src/lib/scraper/bot";
import { autoAssignListings } from "../src/lib/auto-assign";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== TÜM Konya İlanları (emlakçı dahil) ===\n");

  // Tüm ilanları çek - sahibinden filtresi yok
  process.env.ONLY_OWNER = "false";

  const sale = await runBot("konya", "SALE", 10);
  console.log(`\nSatılık: ${sale.accepted} kabul | ${sale.rejected} emlakçı red | ${sale.duplicates} dup\n`);

  const rent = await runBot("konya", "RENT", 5);
  console.log(`\nKiralık: ${rent.accepted} kabul | ${rent.rejected} emlakçı red | ${rent.duplicates} dup`);

  console.log(`\nTOPLAM YENİ: ${sale.accepted + rent.accepted}`);

  await autoAssignListings();

  const total = await prisma.listing.count();
  const active = await prisma.listing.count({ where: { isFromOwner: true } });
  const passive = await prisma.listing.count({ where: { isFromOwner: false } });
  console.log(`\nDB: ${total} toplam | ${active} aktif | ${passive} emlakçı`);

  await prisma.$disconnect();
  process.exit(0);
}

main();
