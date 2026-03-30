import cron from "node-cron";
import { scrapeSahibinden } from "./sahibinden";
import { prisma } from "../prisma";

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
        const saleResult = await scrapeSahibinden(city.slug, "SALE", 3);
        console.log(`${city.name} satılık sonuç:`, saleResult);
      } catch (err) {
        console.error(`${city.name} satılık hata:`, err);
      }

      try {
        // Kiralık
        const rentResult = await scrapeSahibinden(city.slug, "RENT", 3);
        console.log(`${city.name} kiralık sonuç:`, rentResult);
      } catch (err) {
        console.error(`${city.name} kiralık hata:`, err);
      }
    }
  } finally {
    isRunning = false;
  }
}
