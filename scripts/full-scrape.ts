import { scrapeEmlakjet } from "../src/lib/scraper/emlakjet-scraper";

async function main() {
  console.log("=== Tam Scraping Başlıyor ===\n");

  // Satılık - 3 sayfa
  console.log("--- SATILIK (3 sayfa) ---");
  const sale = await scrapeEmlakjet("konya", "SALE", 3);
  console.log(`Satılık: Bulundu ${sale.totalFound} | Kabul ${sale.accepted} | Red ${sale.rejected} | Dup ${sale.duplicates} | Hata ${sale.errors}\n`);

  // Kiralık - 3 sayfa
  console.log("--- KİRALIK (3 sayfa) ---");
  const rent = await scrapeEmlakjet("konya", "RENT", 3);
  console.log(`Kiralık: Bulundu ${rent.totalFound} | Kabul ${rent.accepted} | Red ${rent.rejected} | Dup ${rent.duplicates} | Hata ${rent.errors}\n`);

  console.log("=== TOPLAM ===");
  console.log(`Bulunan: ${sale.totalFound + rent.totalFound}`);
  console.log(`Yeni kabul: ${sale.accepted + rent.accepted}`);
  console.log(`Yeni red: ${sale.rejected + rent.rejected}`);
  console.log(`Duplicate: ${sale.duplicates + rent.duplicates}`);
  console.log(`Süre: ${((sale.duration + rent.duration) / 1000 / 60).toFixed(1)} dakika`);
  process.exit(0);
}
main();
