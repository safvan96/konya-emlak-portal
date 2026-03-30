import { scrapeEmlakjet } from "../src/lib/scraper/emlakjet-scraper";

async function main() {
  console.log("=== Genişletilmiş Kategori Scraping ===\n");

  const sale = await scrapeEmlakjet("konya", "SALE", 2);
  console.log(`\nSatılık: Bulundu ${sale.totalFound} | Yeni ${sale.accepted} | Red ${sale.rejected} | Dup ${sale.duplicates}\n`);

  const rent = await scrapeEmlakjet("konya", "RENT", 2);
  console.log(`\nKiralık: Bulundu ${rent.totalFound} | Yeni ${rent.accepted} | Red ${rent.rejected} | Dup ${rent.duplicates}\n`);

  console.log(`TOPLAM: ${sale.accepted + rent.accepted} yeni ilan eklendi`);
  process.exit(0);
}
main();
