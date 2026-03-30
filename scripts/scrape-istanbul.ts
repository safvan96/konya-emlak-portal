import { scrapeEmlakjet } from "../src/lib/scraper/emlakjet-scraper";
import { autoAssignListings } from "../src/lib/auto-assign";

async function main() {
  console.log("=== İstanbul Scraping ===\n");
  const sale = await scrapeEmlakjet("istanbul", "SALE", 1);
  console.log(`\nSatılık: ${sale.totalFound} bulundu | ${sale.accepted} kabul | ${sale.rejected} red\n`);
  const rent = await scrapeEmlakjet("istanbul", "RENT", 1);
  console.log(`\nKiralık: ${rent.totalFound} bulundu | ${rent.accepted} kabul | ${rent.rejected} red`);
  console.log(`\nToplam yeni: ${sale.accepted + rent.accepted}`);

  console.log("\nOtomatik atama...");
  await autoAssignListings();
  process.exit(0);
}
main();
