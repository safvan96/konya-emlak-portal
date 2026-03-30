/**
 * Sistem sağlık kontrolü ve monitoring scripti.
 * Günlük veya cron ile çalıştırılabilir.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  console.log(`=== Sistem Durumu (${now.toISOString()}) ===\n`);

  // 1. DB bağlantı
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("✓ Veritabanı: Bağlı");
  } catch {
    console.error("✗ Veritabanı: BAĞLANTI HATASI");
  }

  // 2. İlan istatistikleri
  const [total, active, passive, sale, rent] = await Promise.all([
    prisma.listing.count(),
    prisma.listing.count({ where: { isFromOwner: true, status: "ACTIVE" } }),
    prisma.listing.count({ where: { isFromOwner: false } }),
    prisma.listing.count({ where: { listingType: "SALE", isFromOwner: true } }),
    prisma.listing.count({ where: { listingType: "RENT", isFromOwner: true } }),
  ]);
  console.log(`✓ İlanlar: ${total} toplam (${active} aktif, ${passive} pasif)`);
  console.log(`  Satılık: ${sale} | Kiralık: ${rent}`);

  // 3. Müşteri istatistikleri
  const customers = await prisma.user.count({ where: { role: "CUSTOMER" } });
  const assignments = await prisma.assignment.count();
  console.log(`✓ Müşteriler: ${customers} | Atamalar: ${assignments}`);

  // 4. Son scraper çalışması
  const lastRun = await prisma.scraperRun.findFirst({
    orderBy: { startedAt: "desc" },
  });
  if (lastRun) {
    const ago = Math.round((now.getTime() - lastRun.startedAt.getTime()) / 1000 / 60);
    const status = lastRun.status === "completed" ? "✓" : "✗";
    console.log(`${status} Son scraper: ${ago} dk önce (${lastRun.status})`);
    console.log(`  Bulundu: ${lastRun.totalFound} | Kabul: ${lastRun.accepted} | Red: ${lastRun.rejected}`);

    // 24 saatten fazla çalışmadıysa uyar
    if (ago > 1440) {
      console.warn("⚠ UYARI: Scraper 24 saatten fazladır çalışmadı!");
    }
  } else {
    console.warn("⚠ Hiç scraper çalışmamış!");
  }

  // 5. Son 24 saat aktivite
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [newListings, newLogs, scraperRuns] = await Promise.all([
    prisma.listing.count({ where: { createdAt: { gte: yesterday } } }),
    prisma.userLog.count({ where: { createdAt: { gte: yesterday } } }),
    prisma.scraperRun.count({ where: { startedAt: { gte: yesterday } } }),
  ]);
  console.log(`\n=== Son 24 Saat ===`);
  console.log(`  Yeni ilan: ${newListings}`);
  console.log(`  Kullanıcı aksiyonu: ${newLogs}`);
  console.log(`  Scraper çalışması: ${scraperRuns}`);

  // 6. HTTP health check
  try {
    const resp = await fetch("http://localhost:3000/api/health", {
      signal: AbortSignal.timeout(5000),
    });
    const health = await resp.json();
    console.log(`\n✓ HTTP Health: ${health.status} (uptime: ${Math.round(health.uptime)}s)`);
  } catch {
    console.error("\n✗ HTTP Health: UYGULAMA YANIT VERMİYOR!");
  }

  await prisma.$disconnect();
}

main();
