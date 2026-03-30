import { scrapeEmlakjet } from "../src/lib/scraper/emlakjet-scraper";

async function main() {
  console.log("=== Emlakjet Scraper Test ===");
  console.log("Tarih:", new Date().toISOString());
  console.log("Hedef: Konya satılık, 1 sayfa\n");

  try {
    const result = await scrapeEmlakjet("konya", "SALE", 1);
    console.log("\n=== SONUÇ ===");
    console.log(`Toplam bulunan: ${result.totalFound}`);
    console.log(`Kabul edilen (sahibinden): ${result.accepted}`);
    console.log(`Reddedilen (emlakçı): ${result.rejected}`);
    console.log(`Tekrar (duplicate): ${result.duplicates}`);
    console.log(`Hata: ${result.errors}`);
    console.log(`Süre: ${(result.duration / 1000).toFixed(1)} saniye`);
  } catch (err) {
    console.error("HATA:", err instanceof Error ? err.message : err);
  }
  process.exit(0);
}

main();
