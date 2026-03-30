/**
 * Test amaçlı gerçekçi ilan verileri oluşturur.
 * Scraper çalışmadan sistemi test etmek için kullanılır.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const testListings = [
  {
    sahibindenId: "TEST001",
    title: "Selçuklu Bosna Hersek'te 3+1 Daire Sahibinden",
    description: "Sahibinden satılık 3+1 daire. 120 m2, 5. kat, asansörlü, doğalgaz kombi. Eşyasız teslim edilecektir. Krediye uygun. Pazarlık payı vardır. Site içi, kapalı otopark mevcut.",
    price: 3250000,
    currency: "TL",
    listingType: "SALE",
    location: "Konya, Selçuklu, Bosna Hersek Mah.",
    district: "Selçuklu",
    neighborhood: "Bosna Hersek",
    roomCount: "3+1",
    squareMeters: 120,
    buildingAge: "5-10",
    floor: "5",
    imageUrls: [],
    sourceUrl: "https://www.sahibinden.com/ilan/test001",
    isFromOwner: true,
    status: "ACTIVE",
  },
  {
    sahibindenId: "TEST002",
    title: "Meram'da Müstakil Ev Bahçeli Sahibinden",
    description: "2 katlı müstakil ev. Alt kat 2+1, üst kat 3+1. Toplam 250 m2. 500 m2 bahçe. Garaj mevcut. Doğalgaz merkezi sistem. Tapu hazır.",
    price: 5750000,
    currency: "TL",
    listingType: "SALE",
    location: "Konya, Meram, Yenişehir Mah.",
    district: "Meram",
    neighborhood: "Yenişehir",
    roomCount: "5+2",
    squareMeters: 250,
    buildingAge: "11-15",
    floor: "Müstakil",
    imageUrls: [],
    sourceUrl: "https://www.sahibinden.com/ilan/test002",
    isFromOwner: true,
    status: "ACTIVE",
  },
  {
    sahibindenId: "TEST003",
    title: "Karatay Fevzi Çakmak'ta 2+1 Kiralık Daire",
    description: "Sahibinden kiralık 2+1 daire. 85 m2, 3. kat. Kombili, doğalgazlı. Eşyalı teslim. Depozito 1 ay. Site içinde.",
    price: 12000,
    currency: "TL",
    listingType: "RENT",
    location: "Konya, Karatay, Fevzi Çakmak Mah.",
    district: "Karatay",
    neighborhood: "Fevzi Çakmak",
    roomCount: "2+1",
    squareMeters: 85,
    buildingAge: "0-5",
    floor: "3",
    imageUrls: [],
    sourceUrl: "https://www.sahibinden.com/ilan/test003",
    isFromOwner: true,
    status: "ACTIVE",
  },
  {
    sahibindenId: "TEST004",
    title: "Selçuklu'da Arsa 500m2 İmarlı",
    description: "Sahibinden satılık 500 m2 arsa. Konut imarlı, 5 kat izni. Yola cepheli, altyapı hazır. Tapu müstakil.",
    price: 2100000,
    currency: "TL",
    listingType: "SALE",
    location: "Konya, Selçuklu, Yazır Mah.",
    district: "Selçuklu",
    neighborhood: "Yazır",
    roomCount: null,
    squareMeters: 500,
    buildingAge: null,
    floor: null,
    imageUrls: [],
    sourceUrl: "https://www.sahibinden.com/ilan/test004",
    isFromOwner: true,
    status: "ACTIVE",
  },
  {
    sahibindenId: "TEST005",
    title: "Selçuklu'da 4+1 Lüks Daire - EMLAKÇI İLANI",
    description: "Gayrimenkul danışmanınız Ahmet Yılmaz olarak sizlere Selçuklu'nun en prestijli lokasyonunda 4+1 lüks daire sunuyoruz. Portföy no: 12345. Ofisimiz 7/24 hizmetinizdedir. Detaylı bilgi için arayın.",
    price: 6500000,
    currency: "TL",
    listingType: "SALE",
    location: "Konya, Selçuklu, Büyükşehir Mah.",
    district: "Selçuklu",
    neighborhood: "Büyükşehir",
    roomCount: "4+1",
    squareMeters: 180,
    buildingAge: "0-5",
    floor: "8",
    imageUrls: [],
    sourceUrl: "https://www.sahibinden.com/ilan/test005",
    isFromOwner: false,
    rejectionReason: "Emlakçı tespiti: gayrimenkul danışmanı, portföy no, ofisimiz",
    status: "PASSIVE",
  },
  {
    sahibindenId: "TEST006",
    title: "Meram'da 3+1 Satılık Daire Sahibinden",
    description: "Sahibimden satılık temiz daire. 110 m2, 2. kat. Yeni boyandı, mutfak dolapları yenilendi. Okula ve markete yakın. Ulaşım kolay.",
    price: 2800000,
    currency: "TL",
    listingType: "SALE",
    location: "Konya, Meram, Havzan Mah.",
    district: "Meram",
    neighborhood: "Havzan",
    roomCount: "3+1",
    squareMeters: 110,
    buildingAge: "16-20",
    floor: "2",
    imageUrls: [],
    sourceUrl: "https://www.sahibinden.com/ilan/test006",
    isFromOwner: true,
    status: "ACTIVE",
  },
  {
    sahibindenId: "TEST007",
    title: "Karatay'da Satılık Dükkan 80m2",
    description: "Cadde üzeri satılık dükkan. 80 m2, giriş kat. Kiracılı (aylık 15.000 TL). Yatırıma uygun.",
    price: 4200000,
    currency: "TL",
    listingType: "SALE",
    location: "Konya, Karatay, Akçeşme Mah.",
    district: "Karatay",
    neighborhood: "Akçeşme",
    roomCount: null,
    squareMeters: 80,
    buildingAge: "11-15",
    floor: "Giriş",
    imageUrls: [],
    sourceUrl: "https://www.sahibinden.com/ilan/test007",
    isFromOwner: true,
    status: "ACTIVE",
  },
  {
    sahibindenId: "TEST008",
    title: "RE/MAX'tan Selçuklu'da Satılık Villa - EMLAKÇI İLANI",
    description: "RE/MAX Premium - Gayrimenkul Danışmanı Mehmet Kaya. Selçuklu'nun en güzel villaları burada. Profesyonel ekibimiz ile sizlere hizmet veriyoruz. Franchise ofisimiz Selçuklu merkezde.",
    price: 12000000,
    currency: "TL",
    listingType: "SALE",
    location: "Konya, Selçuklu, Sille Mah.",
    district: "Selçuklu",
    neighborhood: "Sille",
    roomCount: "5+1",
    squareMeters: 350,
    buildingAge: "0-5",
    floor: "Villa",
    imageUrls: [],
    sourceUrl: "https://www.sahibinden.com/ilan/test008",
    isFromOwner: false,
    rejectionReason: "Emlakçı tespiti: satıcı adı: RE/MAX, remax, franchise, profesyonel ekibimiz, hizmet veriyoruz",
    status: "PASSIVE",
  },
  {
    sahibindenId: "TEST009",
    title: "Selçuklu Akademi'de 2+1 Kiralık Daire",
    description: "Üniversiteye yakın 2+1 kiralık daire. Eşyalı, kombili. Öğrenciye uygun. Aidat 500 TL. Su + doğalgaz ayrı.",
    price: 9500,
    currency: "TL",
    listingType: "RENT",
    location: "Konya, Selçuklu, Akademi Mah.",
    district: "Selçuklu",
    neighborhood: "Akademi",
    roomCount: "2+1",
    squareMeters: 75,
    buildingAge: "5-10",
    floor: "4",
    imageUrls: [],
    sourceUrl: "https://www.sahibinden.com/ilan/test009",
    isFromOwner: true,
    status: "ACTIVE",
  },
  {
    sahibindenId: "TEST010",
    title: "Meram Yaka'da 4+1 Dublex Daire Sahibinden",
    description: "Sahibinden satılık 4+1 dublex daire. 200 m2. Alt kat salon + mutfak + 1 oda + wc. Üst kat 3 yatak odası + banyo. Teras mevcut. Manzaralı.",
    price: 4900000,
    currency: "TL",
    listingType: "SALE",
    location: "Konya, Meram, Yaka Mah.",
    district: "Meram",
    neighborhood: "Yaka",
    roomCount: "4+1",
    squareMeters: 200,
    buildingAge: "0-5",
    floor: "Dublex",
    imageUrls: [],
    sourceUrl: "https://www.sahibinden.com/ilan/test010",
    isFromOwner: true,
    status: "ACTIVE",
  },
];

async function main() {
  console.log("Test ilanları ekleniyor...\n");

  const city = await prisma.city.findUnique({ where: { slug: "konya" } });
  if (!city) {
    console.error("Konya şehri bulunamadı! Önce seed çalıştırın.");
    process.exit(1);
  }

  // Kategori eşleşmeleri
  const categories = await prisma.category.findMany();
  const catMap = new Map(categories.map(c => [c.slug, c.id]));

  let added = 0;
  let skipped = 0;

  for (const listing of testListings) {
    const existing = await prisma.listing.findUnique({
      where: { sahibindenId: listing.sahibindenId },
    });
    if (existing) {
      console.log(`  Atlandı (mevcut): ${listing.title}`);
      skipped++;
      continue;
    }

    // Kategori tahmin
    const lower = listing.title.toLowerCase();
    let categoryId: string | null = null;
    if (lower.includes("arsa")) categoryId = catMap.get("arsa") || null;
    else if (lower.includes("villa")) categoryId = catMap.get("villa") || null;
    else if (lower.includes("müstakil")) categoryId = catMap.get("mustakil-ev") || null;
    else if (lower.includes("dükkan")) categoryId = catMap.get("dukkan") || null;
    else categoryId = catMap.get("daire") || null;

    await prisma.listing.create({
      data: {
        ...listing,
        cityId: city.id,
        categoryId,
        rejectionReason: listing.rejectionReason || null,
      },
    });

    const icon = listing.isFromOwner ? "✓" : "✗";
    console.log(`  ${icon} ${listing.title} - ${listing.price.toLocaleString("tr-TR")} TL`);
    added++;
  }

  console.log(`\n=== Sonuç ===`);
  console.log(`Eklenen: ${added}`);
  console.log(`Atlanan: ${skipped}`);
  console.log(`Toplam: ${testListings.length} (${testListings.filter(l => l.isFromOwner).length} sahibinden, ${testListings.filter(l => !l.isFromOwner).length} emlakçı)`);

  await prisma.$disconnect();
}

main();
