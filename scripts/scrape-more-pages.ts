import { runBot } from "../src/lib/scraper/bot";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

process.env.ONLY_OWNER = "false";

async function main() {
  console.log("=== 20 Sayfa Scraping ===\n");
  const r = await runBot("konya", "SALE", 20);
  console.log(`\nSatılık: ${r.accepted} yeni | ${r.duplicates} dup | ${r.rejected} red`);

  const total = await prisma.listing.count();
  console.log(`DB toplam: ${total}`);
  await prisma.$disconnect();
  process.exit(0);
}
main();
