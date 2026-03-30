export async function register() {
  // Sadece Node.js runtime'da çalıştır (edge değil)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("@/lib/scraper/scheduler");

    if (process.env.SCRAPER_ENABLED === "true") {
      startScheduler();
    } else {
      console.log("Scraper scheduler devre dışı (SCRAPER_ENABLED=false)");
    }
  }
}
