/**
 * Veritabanı backup scripti.
 * JSON formatında tüm tabloları export eder.
 * pg_dump gerekmez, Prisma ile çalışır.
 *
 * Kullanım: npx tsx scripts/backup.ts
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function main() {
  const date = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);
  const backupDir = path.join(process.env.USERPROFILE || process.env.HOME || ".", "backups", "emlak-portal");

  fs.mkdirSync(backupDir, { recursive: true });

  console.log(`=== Veritabanı Backup (${date}) ===\n`);

  const [users, listings, categories, cities, assignments, favorites, priceHistory, scraperRuns, blacklist, preferences, logs] = await Promise.all([
    prisma.user.findMany(),
    prisma.listing.findMany(),
    prisma.category.findMany(),
    prisma.city.findMany(),
    prisma.assignment.findMany(),
    prisma.favorite.findMany(),
    prisma.priceHistory.findMany(),
    prisma.scraperRun.findMany(),
    prisma.blacklistKeyword.findMany(),
    prisma.customerPreference.findMany(),
    prisma.userLog.findMany({ take: 10000, orderBy: { createdAt: "desc" } }),
  ]);

  const data = {
    exportDate: new Date().toISOString(),
    version: "1.0",
    tables: {
      users: { count: users.length, data: users.map(u => ({ ...u, password: "***" })) },
      listings: { count: listings.length, data: listings },
      categories: { count: categories.length, data: categories },
      cities: { count: cities.length, data: cities },
      assignments: { count: assignments.length, data: assignments },
      favorites: { count: favorites.length, data: favorites },
      priceHistory: { count: priceHistory.length, data: priceHistory },
      scraperRuns: { count: scraperRuns.length, data: scraperRuns },
      blacklistKeywords: { count: blacklist.length, data: blacklist },
      customerPreferences: { count: preferences.length, data: preferences },
      userLogs: { count: logs.length, data: logs },
    },
  };

  const filename = `backup_${date}.json`;
  const filepath = path.join(backupDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));

  const sizeMB = (fs.statSync(filepath).size / 1024 / 1024).toFixed(2);
  console.log(`Backup: ${filepath}`);
  console.log(`Boyut: ${sizeMB} MB`);
  console.log("");
  console.log("Tablo sayıları:");
  Object.entries(data.tables).forEach(([name, table]) => {
    console.log(`  ${name}: ${table.count}`);
  });

  // 30 günden eski backupları sil
  const files = fs.readdirSync(backupDir).filter(f => f.startsWith("backup_") && f.endsWith(".json"));
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  let deleted = 0;
  for (const file of files) {
    const filePath = path.join(backupDir, file);
    const stat = fs.statSync(filePath);
    if (stat.mtimeMs < thirtyDaysAgo) {
      fs.unlinkSync(filePath);
      deleted++;
    }
  }
  if (deleted > 0) console.log(`\n${deleted} eski backup silindi.`);

  await prisma.$disconnect();
}

main();
