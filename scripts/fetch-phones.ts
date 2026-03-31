/**
 * Mevcut ilanların telefon numaralarını emlakjet detay sayfasından çeker.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function randomDelay(): Promise<void> {
  const delay = 2000 + Math.floor(Math.random() * 3000);
  return new Promise((r) => setTimeout(r, delay));
}

async function main() {
  const listings = await prisma.listing.findMany({
    where: { sellerPhone: null, sourceUrl: { contains: "emlakjet" } },
    select: { id: true, title: true, sourceUrl: true },
  });

  console.log(`${listings.length} ilan için telefon çekiliyor...\n`);

  let found = 0;
  for (const l of listings) {
    try {
      const resp = await fetch(l.sourceUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) continue;
      const html = await resp.text();

      // Telefon
      const phoneMatch = html.match(/"telephone"\s*:\s*"(\d{10,11})"/);
      let phone = phoneMatch ? phoneMatch[1] : null;
      if (phone && phone.length === 10 && !phone.startsWith("0")) phone = "0" + phone;

      // İsim - açıklamanın başında
      const descMatch = html.match(/"description"\s*:\s*"([^"]+)"/);
      let name: string | null = null;
      if (descMatch) {
        const nameMatch = descMatch[1].match(/^([^,]+?)(?:\s+\w+\s+Mah)/);
        if (nameMatch && nameMatch[1].length < 40) name = nameMatch[1].trim();
      }
      if (!name || name.toLowerCase() === "sahibinden") name = "Sahibinden";

      if (phone) {
        await prisma.listing.update({
          where: { id: l.id },
          data: { sellerPhone: phone, sellerName: name },
        });
        found++;
        console.log(`  ${l.title.substring(0, 45)} → ${phone} (${name})`);
      }

      await randomDelay();
    } catch {
      // skip
    }
  }

  console.log(`\nTelefon bulunan: ${found}/${listings.length}`);
  await prisma.$disconnect();
}

main();
