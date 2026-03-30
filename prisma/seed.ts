import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Şehirler
  const konya = await prisma.city.upsert({
    where: { slug: "konya" },
    update: {},
    create: {
      name: "Konya",
      slug: "konya",
      sahibindenCityId: "42",
      isActive: true,
    },
  });

  console.log("Şehir oluşturuldu:", konya.name);

  // Admin kullanıcı
  const hashedPassword = await bcrypt.hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@emlakportal.com" },
    update: {},
    create: {
      email: "admin@emlakportal.com",
      password: hashedPassword,
      name: "Admin",
      surname: "Portal",
      role: "ADMIN",
    },
  });

  console.log("Admin oluşturuldu:", admin.email);

  // Test müşteri
  const customerPassword = await bcrypt.hash("musteri123", 12);
  const customer = await prisma.user.upsert({
    where: { email: "musteri@emlakportal.com" },
    update: {},
    create: {
      email: "musteri@emlakportal.com",
      password: customerPassword,
      name: "Test",
      surname: "Müşteri",
      role: "CUSTOMER",
    },
  });

  console.log("Test müşteri oluşturuldu:", customer.email);

  // Kategoriler
  const categories = [
    { name: "Daire", slug: "daire" },
    { name: "Müstakil Ev", slug: "mustakil-ev" },
    { name: "Villa", slug: "villa" },
    { name: "Arsa", slug: "arsa" },
    { name: "Tarla", slug: "tarla" },
    { name: "Dükkan", slug: "dukkan" },
    { name: "Ofis", slug: "ofis" },
    { name: "Depo", slug: "depo" },
    { name: "Bina", slug: "bina" },
    { name: "Kooperatif", slug: "kooperatif" },
    { name: "Devremülk", slug: "devremulk" },
    { name: "Residans", slug: "residans" },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }

  console.log("Kategoriler oluşturuldu:", categories.length);

  // Blacklist kelimeleri
  const blacklistKeywords = [
    "emlak danışmanı",
    "gayrimenkul danışmanı",
    "remax",
    "re/max",
    "century 21",
    "coldwell banker",
    "keller williams",
    "emlak ofisi",
    "gayrimenkul ofisi",
    "portföy no",
    "portföy numarası",
    "danışmanınız",
    "emlak müşaviri",
    "gayrimenkul yatırım danışmanı",
    "turyap",
    "emlak konut",
    "franchise",
    "ofisimiz",
    "şubemiz",
    "mağazamız",
    "profesyonel ekibimiz",
    "gayrimenkul firması",
    "emlak firması",
    "broker",
    "portföyümüz",
    "hizmet veriyoruz",
    "danışmanlık hizmeti",
    "referans no",
    "ilan no:",
  ];

  for (const keyword of blacklistKeywords) {
    await prisma.blacklistKeyword.upsert({
      where: { keyword },
      update: {},
      create: { keyword },
    });
  }

  console.log("Blacklist kelimeleri oluşturuldu:", blacklistKeywords.length);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
