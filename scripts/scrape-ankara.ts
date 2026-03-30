import { scrapeEmlakjet } from "../src/lib/scraper/emlakjet-scraper";

async function main() {
  console.log("=== Ankara Scraping ===\n");

  const sale = await scrapeEmlakjet("ankara", "SALE", 1);
  console.log(`\nSatılık: ${sale.totalFound} bulundu | ${sale.accepted} kabul | ${sale.rejected} red\n`);

  const rent = await scrapeEmlakjet("ankara", "RENT", 1);
  console.log(`\nKiralık: ${rent.totalFound} bulundu | ${rent.accepted} kabul | ${rent.rejected} red`);

  console.log(`\nToplam yeni: ${sale.accepted + rent.accepted} ilan`);
  process.exit(0);
}
main();
