import { smartScrape } from "../src/lib/scraper/sahibinden";

async function main() {
  console.log("=== Scraper Test Başlıyor ===");
  console.log("Tarih:", new Date().toISOString());
  console.log("");
  console.log("Mod:", process.env.SCRAPER_API_KEY ? "ScraperAPI" :
    process.env.ZENROWS_API_KEY ? "Zenrows" :
    process.env.PROXY_URL ? "Proxy" : "Direkt (Puppeteer)");
  console.log("");

  try {
    const result = await smartScrape("konya", "SALE", 1);
    console.log("");
    console.log("=== SONUÇ ===");
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
