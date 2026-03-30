import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Demo verisi - uygulamanin gorselligi icin
async function main() {
  const konya = await prisma.city.findUnique({ where: { slug: "konya" } });
  if (!konya) { console.log("Once normal seed calistirin"); return; }

  const categories = await prisma.category.findMany();
  const catMap = Object.fromEntries(categories.map((c) => [c.slug, c.id]));

  // Demo musteriler
  const pw = await bcrypt.hash("demo123", 12);
  const customers = [];
  const demoCustomers = [
    { name: "Ahmet", surname: "Yilmaz", email: "ahmet@demo.com" },
    { name: "Fatma", surname: "Demir", email: "fatma@demo.com" },
    { name: "Mehmet", surname: "Kaya", email: "mehmet@demo.com" },
    { name: "Ayse", surname: "Celik", email: "ayse@demo.com" },
    { name: "Hasan", surname: "Ozturk", email: "hasan@demo.com" },
  ];

  for (const c of demoCustomers) {
    const user = await prisma.user.upsert({
      where: { email: c.email },
      update: {},
      create: { ...c, password: pw, role: "CUSTOMER" },
    });
    customers.push(user);
  }
  console.log(`${customers.length} demo musteri olusturuldu`);

  // Demo ilanlar
  const districts = ["Selcuklu", "Meram", "Karatay", "Bosna Hersek", "Cimenlik", "Horozluhan"];
  const types: Array<"SALE" | "RENT"> = ["SALE", "RENT"];
  const rooms = ["1+1", "2+1", "3+1", "4+1", "5+2"];
  const catSlugs = ["daire", "mustakil-ev", "villa", "arsa"];

  const listings = [];
  for (let i = 0; i < 30; i++) {
    const isSale = types[i % 2];
    const district = districts[i % districts.length];
    const room = rooms[i % rooms.length];
    const catSlug = catSlugs[i % catSlugs.length];
    const price = isSale
      ? Math.floor(Math.random() * 5000000) + 500000
      : Math.floor(Math.random() * 20000) + 3000;

    const listing = await prisma.listing.create({
      data: {
        sahibindenId: `demo-${Date.now()}-${i}`,
        title: `${district}'de ${isSale === "SALE" ? "Satilik" : "Kiralik"} ${room} ${catSlug === "arsa" ? "Arsa" : "Daire"}`,
        description: `${district} bolgesinde, ${room} odalı, bakimli, ana yola yakin. Sahibinden satilik/kiralik ilan. Detaylar icin iletisime geciniz.`,
        price,
        currency: "TL",
        listingType: isSale,
        location: `Konya, ${district}`,
        district,
        roomCount: catSlug === "arsa" ? null : room,
        squareMeters: catSlug === "arsa" ? Math.floor(Math.random() * 500) + 200 : Math.floor(Math.random() * 100) + 60,
        buildingAge: catSlug === "arsa" ? null : `${Math.floor(Math.random() * 20) + 1}`,
        floor: catSlug === "arsa" ? null : `${Math.floor(Math.random() * 10) + 1}`,
        imageUrls: [],
        sourceUrl: `https://www.sahibinden.com/ilan/demo-${i}`,
        isFromOwner: true,
        status: "ACTIVE",
        cityId: konya.id,
        categoryId: catMap[catSlug] || null,
      },
    });
    listings.push(listing);
  }
  console.log(`${listings.length} demo ilan olusturuldu`);

  // Demo atamalar
  let assignCount = 0;
  for (const customer of customers) {
    const shuffled = [...listings].sort(() => Math.random() - 0.5);
    const assigned = shuffled.slice(0, Math.floor(Math.random() * 8) + 3);
    for (const listing of assigned) {
      try {
        await prisma.assignment.create({
          data: { userId: customer.id, listingId: listing.id, assignedBy: "demo-admin" },
        });
        assignCount++;
      } catch { /* duplicate */ }
    }
  }
  console.log(`${assignCount} demo atama olusturuldu`);

  // Demo favoriler
  let favCount = 0;
  for (const customer of customers) {
    const shuffled = [...listings].sort(() => Math.random() - 0.5);
    for (const listing of shuffled.slice(0, 3)) {
      try {
        await prisma.favorite.create({
          data: { userId: customer.id, listingId: listing.id },
        });
        favCount++;
      } catch { /* duplicate */ }
    }
  }
  console.log(`${favCount} demo favori olusturuldu`);

  // Demo scraper run
  await prisma.scraperRun.create({
    data: {
      cityId: konya.id,
      totalFound: 45,
      accepted: 30,
      rejected: 10,
      duplicates: 5,
      errors: 0,
      duration: 125000,
      status: "completed",
      completedAt: new Date(),
    },
  });
  console.log("Demo scraper run olusturuldu");

  console.log("\nDemo verisi tamamlandi!");
  console.log("Demo musteriler: demo123 sifresi ile giris yapabilir");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
