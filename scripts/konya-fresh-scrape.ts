import { scrapeEmlakjet } from "../src/lib/scraper/emlakjet-scraper";

async function main() {
  console.log("=== Konya - Agresif Filtre ile Scraping ===\n");
  const sale = await scrapeEmlakjet("konya", "SALE", 3);
  console.log(`\nSatılık: ${sale.totalFound} bulundu | ${sale.accepted} GERÇEK SAHİP | ${sale.rejected} EMLAKÇI\n`);
  const rent = await scrapeEmlakjet("konya", "RENT", 3);
  console.log(`\nKiralık: ${rent.totalFound} bulundu | ${rent.accepted} GERÇEK SAHİP | ${rent.rejected} EMLAKÇI`);
  console.log(`\nTOPLAM GERÇEK SAHİP: ${sale.accepted + rent.accepted}`);
  process.exit(0);
}
main();
