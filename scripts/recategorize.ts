/**
 * İlanların kategorisini başlık + açıklama + oda bilgisine göre yeniden tayin eder.
 *
 * 13 kategori destekler: daire, mustakil-ev, villa, arsa, tarla, dukkan, ofis,
 * depo, bina, kooperatif, devremulk, residans, ciftlik-evi
 *
 * Priority order (spesifik → genel):
 *  1. devremülk → devremulk
 *  2. residans → residans
 *  3. çiftlik evi → ciftlik-evi
 *  4. villa → villa
 *  5. müstakil/köy evi/dubleks → mustakil-ev
 *  6. kooperatif → kooperatif (eğer "daire" yoksa)
 *  7. bina → bina
 *  8. ofis → ofis (eğer "daire" yoksa)
 *  9. dükkan/dukkan → dukkan
 * 10. depo/antrepo → depo
 * 11. tarla/bağ/bahçe → tarla
 * 12. arsa → arsa
 * 13. daire veya oda-pattern → daire
 * 14. default → daire
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function determineCategorySlug(title: string, description: string | null, roomCount: string | null): string {
  // Türkçe karakterleri normalize et — JS \b non-ASCII için çalışmıyor
  const normMap: Record<string,string> = {"ç":"c","ğ":"g","ı":"i","ö":"o","ş":"s","ü":"u","İ":"i","Ç":"c","Ğ":"g","Ö":"o","Ş":"s","Ü":"u"};
  const t = title.toLowerCase().replace(/[^\x00-\x7F]/g, (c) => normMap[c] || c);
  const hasRoom = /\d\s*\+\s*\d/.test(title) || !!roomCount;

  // 1-4: En spesifik
  if (/\bdevremulk\b/.test(t)) return "devremulk";
  if (/\bresidans\b|\brezidans\b/.test(t)) return "residans";
  if (/\bciftlik\s*evi\b/.test(t)) return "ciftlik-evi";
  if (/\bvilla\b/.test(t)) return "villa";

  // 5: Müstakil ev / dubleks / köy evi
  if (/\bmustakil\b|\bkoy\s*evi\b|\bdubleks\b|\btripleks\b/.test(t)) return "mustakil-ev";

  // 6: Kooperatif (daire ile birlikte geçebilir ama kooperatif daha spesifik)
  if (/\bkooperatif\b|\bkooparatif\b/.test(t)) return "kooperatif";

  // 7: Bina (tüm bina — "daire" ile çakışmaz genelde)
  if (/\bbina\b/.test(t) && !hasRoom) return "bina";

  // 8: Ofis (iş yeri)
  if (/\bofis\b|\bis\s*yeri\b/.test(t)) return "ofis";

  // 9: Dükkan
  if (/\bdukkan\b/.test(t)) return "dukkan";

  // 10: Depo / antrepo
  if (/\bdepo\b|\bantrepo\b/.test(t)) return "depo";

  // 11: Tarla / bağ / bahçe (spesifik arazi tipi)
  if (/\btarla\b|\bbag\b|\bbahce\b/.test(t)) return "tarla";

  // 12: Oda pattern varsa daire
  if (hasRoom && !/^\s*arsa\b|^\s*satilik\s+arsa\b/.test(t)) {
    return "daire";
  }

  // 13: Daire keyword
  if (/\bdaire\b/.test(t)) return "daire";

  // 14: Arsa (compound'ları dışla: "arsalı", "arsa üzeri")
  if (/\barsa\b/.test(t) && !/arsali|arsa\s+uzeri|arsa\s+cephe/.test(t)) {
    return "arsa";
  }

  // Default
  return "daire";
}

async function main() {
  const categories = await prisma.category.findMany();
  const slugToId = new Map(categories.map((c) => [c.slug, c.id]));
  const idToSlug = new Map(categories.map((c) => [c.id, c.slug]));

  const listings = await prisma.listing.findMany({
    select: { id: true, title: true, description: true, roomCount: true, categoryId: true },
  });
  console.log(`${listings.length} ilan yeniden kategorize ediliyor (13 kategori)...\n`);

  let changed = 0;
  const delta: Record<string, number> = {};

  for (const l of listings) {
    const newSlug = determineCategorySlug(l.title, l.description, l.roomCount);
    const newId = slugToId.get(newSlug);
    if (!newId) {
      console.warn(`  ⚠ Bilinmeyen slug: ${newSlug} (${l.title?.substring(0, 40)})`);
      continue;
    }
    if (newId !== l.categoryId) {
      changed++;
      const oldSlug = l.categoryId ? idToSlug.get(l.categoryId) : "null";
      const key = `${oldSlug} → ${newSlug}`;
      delta[key] = (delta[key] || 0) + 1;
      await prisma.listing.update({
        where: { id: l.id },
        data: { categoryId: newId },
      });
    }
  }

  console.log(`=== Sonuç ===`);
  console.log(`Toplam değişen: ${changed}`);
  console.log(`Dağılım:`);
  Object.entries(delta)
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  const finalCounts = await prisma.listing.groupBy({ by: ["categoryId"], _count: true });
  console.log(`\nGüncel kategori sayıları:`);
  finalCounts
    .map((c) => ({ slug: c.categoryId ? idToSlug.get(c.categoryId) : "null", count: c._count }))
    .sort((a, b) => b.count - a.count)
    .forEach((c) => console.log(`  ${c.slug}: ${c.count}`));

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
