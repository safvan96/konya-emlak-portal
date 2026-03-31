import { scrapeEmlakjet } from "../src/lib/scraper/emlakjet-scraper";
import { autoAssignListings } from "../src/lib/auto-assign";

async function main() {
  console.log("=== Konya 5 Sayfa Scraping ===\n");
  const sale = await scrapeEmlakjet("konya", "SALE", 5);
  console.log(`\nSatılık: ${sale.totalFound} bulundu | ${sale.accepted} yeni | ${sale.duplicates} dup\n`);
  const rent = await scrapeEmlakjet("konya", "RENT", 5);
  console.log(`\nKiralık: ${rent.totalFound} bulundu | ${rent.accepted} yeni | ${rent.duplicates} dup`);
  console.log(`\nTOPLAM YENİ: ${sale.accepted + rent.accepted}`);

  if (sale.accepted + rent.accepted > 0) {
    console.log("\nOtomatik atama...");
    await autoAssignListings();
  }
  process.exit(0);
}
main();
