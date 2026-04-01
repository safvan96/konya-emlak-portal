import { scrapeSahibinden } from "../src/lib/scraper/sahibinden-bot";

async function main() {
  console.log("=== Sahibinden.com Bot Başlatılıyor ===\n");

  try {
    const sale = await scrapeSahibinden("konya", "SALE", 2);
    console.log(`\nSatılık: ${sale.accepted} kabul | ${sale.rejected} red | ${sale.duplicates} dup\n`);
  } catch (err) {
    console.error("Satılık hata:", err instanceof Error ? err.message : err);
  }

  try {
    const rent = await scrapeSahibinden("konya", "RENT", 1);
    console.log(`\nKiralık: ${rent.accepted} kabul | ${rent.rejected} red | ${rent.duplicates} dup`);
  } catch (err) {
    console.error("Kiralık hata:", err instanceof Error ? err.message : err);
  }

  process.exit(0);
}
main();
