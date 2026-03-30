import { scrapeEmlakjet } from "../src/lib/scraper/emlakjet-scraper";

async function main() {
  console.log("=== Kiralık İlanlar Çekiliyor ===\n");
  const result = await scrapeEmlakjet("konya", "RENT", 1);
  console.log("\n=== SONUÇ ===");
  console.log(`Toplam: ${result.totalFound} | Kabul: ${result.accepted} | Red: ${result.rejected} | Duplicate: ${result.duplicates} | Hata: ${result.errors}`);
  console.log(`Süre: ${(result.duration / 1000).toFixed(0)}s`);
  process.exit(0);
}
main();
