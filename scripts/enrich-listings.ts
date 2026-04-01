/**
 * Mevcut ilanların detaylarını WebFetch ile zenginleştirir.
 * İlan sahibi gerçek adı, detaylı açıklama, bina yaşı vb. günceller.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// WebFetch benzeri - emlakjet detay sayfasını çek
async function fetchDetail(url: string): Promise<any> {
  const resp = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept-Language": "tr-TR,tr;q=0.9",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) return null;
  const html = await resp.text();

  // JSON fields
  const fields: Record<string, string> = {};
  const re = /"(\w+)"\s*:\s*"([^"]{1,1000})"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (!fields[m[1]]) fields[m[1]] = m[2];
  }

  // Telefon
  const phoneMatch = html.match(/"telephone"\s*:\s*"(\d{10,11})"/);
  let phone = phoneMatch ? phoneMatch[1] : null;
  if (phone && phone.length === 10 && !phone.startsWith("0")) phone = "0" + phone;

  // İlan sahibi adı - description'dan
  const desc = fields.description || "";
  let ownerName = "Sahibinden";
  const nameMatch = desc.match(/^([^,]+?)(?:\s+\w+\s+Mah)/);
  if (nameMatch && nameMatch[1].length < 40) ownerName = nameMatch[1].trim();
  if (ownerName.toLowerCase() === "sahibinden") ownerName = "Sahibinden";

  // Bina yaşı, kat bilgisi - HTML'den
  const ageMatch = html.match(/buildingAge['"]\s*:\s*['"]([^'"]+)/i);
  const floorMatch = html.match(/floorNumber['"]\s*:\s*['"]([^'"]+)/i);

  return {
    phone,
    ownerName,
    buildingAge: ageMatch ? ageMatch[1] : null,
    floor: floorMatch ? floorMatch[1] : null,
  };
}

async function main() {
  const listings = await prisma.listing.findMany({
    where: { isFromOwner: true, sourceUrl: { contains: "emlakjet" } },
    select: { id: true, title: true, sourceUrl: true, sellerName: true, sellerPhone: true },
  });

  console.log(`${listings.length} ilan zenginleştiriliyor...\n`);

  let updated = 0;
  for (const l of listings) {
    try {
      const detail = await fetchDetail(l.sourceUrl);
      if (!detail) continue;

      const updates: any = {};
      if (detail.phone && detail.phone !== l.sellerPhone) updates.sellerPhone = detail.phone;
      if (detail.ownerName !== "Sahibinden" && detail.ownerName !== l.sellerName) updates.sellerName = detail.ownerName;
      if (detail.buildingAge) updates.buildingAge = detail.buildingAge;
      if (detail.floor) updates.floor = detail.floor;

      if (Object.keys(updates).length > 0) {
        await prisma.listing.update({ where: { id: l.id }, data: updates });
        updated++;
        console.log(`  ${l.title.substring(0, 45)} → ${updates.sellerName || l.sellerName} | ${updates.sellerPhone || l.sellerPhone}`);
      }

      // Rate limit
      await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));
    } catch { /* skip */ }
  }

  console.log(`\n${updated}/${listings.length} ilan güncellendi`);
  await prisma.$disconnect();
  process.exit(0);
}

main();
