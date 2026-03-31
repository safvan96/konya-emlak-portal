import cron from "node-cron";
import { runBot } from "./bot";
import { prisma } from "../prisma";
import { autoAssignListings } from "../auto-assign";

let isRunning = false;

export function startScheduler() {
  // Sabah 08:00 ve akşam 20:00
  cron.schedule("0 8,20 * * *", async () => {
    await runScraperForAllCities();
  });

  console.log("Scraper scheduler başlatıldı (08:00 ve 20:00)");
}

export async function runScraperForAllCities() {
  if (isRunning) {
    console.log("Scraper zaten çalışıyor, atlanıyor.");
    return;
  }

  isRunning = true;

  try {
    const activeCities = await prisma.city.findMany({
      where: { isActive: true },
    });

    for (const city of activeCities) {
      console.log(`Scraping başlatılıyor: ${city.name}`);

      try {
        // Satılık
        const saleResult = await runBot(city.slug, "SALE", 3);
        console.log(`${city.name} satılık sonuç:`, saleResult);
      } catch (err) {
        console.error(`${city.name} satılık hata:`, err);
      }

      try {
        // Kiralık
        const rentResult = await runBot(city.slug, "RENT", 3);
        console.log(`${city.name} kiralık sonuç:`, rentResult);
      } catch (err) {
        console.error(`${city.name} kiralık hata:`, err);
      }
    }
    // Scraping bittikten sonra otomatik atama calistir
    try {
      await autoAssignListings();
      console.log("Otomatik atama tamamlandi.");
    } catch (err) {
      console.error("Otomatik atama hata:", err);
    }
  } finally {
    isRunning = false;
  }
}
