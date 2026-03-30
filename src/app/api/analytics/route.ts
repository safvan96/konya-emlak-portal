import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Sehir bazli ilan dagilimi
  const byCity = await prisma.listing.groupBy({
    by: ["cityId"],
    _count: true,
    where: { isFromOwner: true, status: "ACTIVE" },
  });

  const cities = await prisma.city.findMany({ select: { id: true, name: true } });
  const cityMap = Object.fromEntries(cities.map((c) => [c.id, c.name]));

  const byCityData = byCity.map((item) => ({
    city: cityMap[item.cityId] || "Bilinmiyor",
    count: item._count,
  })).sort((a, b) => b.count - a.count);

  // Kategori bazli ilan dagilimi
  const byCategory = await prisma.listing.groupBy({
    by: ["categoryId"],
    _count: true,
    where: { isFromOwner: true, status: "ACTIVE" },
  });

  const categories = await prisma.category.findMany({ select: { id: true, name: true } });
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  const byCategoryData = byCategory.map((item) => ({
    category: item.categoryId ? catMap[item.categoryId] || "Diger" : "Kategorisiz",
    count: item._count,
  })).sort((a, b) => b.count - a.count);

  // Durum bazli dagilim
  const byStatus = await prisma.listing.groupBy({
    by: ["status"],
    _count: true,
  });

  const statusLabels: Record<string, string> = {
    ACTIVE: "Aktif", PASSIVE: "Pasif", SOLD: "Satildi", RENTED: "Kiralandi",
  };

  const byStatusData = byStatus.map((item) => ({
    status: statusLabels[item.status] || item.status,
    count: item._count,
  }));

  // Tip bazli dagilim
  const byType = await prisma.listing.groupBy({
    by: ["listingType"],
    _count: true,
    where: { isFromOwner: true },
  });

  const byTypeData = byType.map((item) => ({
    type: item.listingType === "SALE" ? "Satilik" : "Kiralik",
    count: item._count,
  }));

  // Son 7 gun scraper istatistikleri
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const recentScrapes = await prisma.scraperRun.findMany({
    where: { startedAt: { gte: weekAgo }, status: "completed" },
    orderBy: { startedAt: "asc" },
    select: { startedAt: true, accepted: true, rejected: true, duplicates: true },
  });

  // Fiyat istatistikleri (aktif sahibinden ilanlari)
  const priceStats = await prisma.listing.aggregate({
    where: { isFromOwner: true, status: "ACTIVE", price: { not: null } },
    _avg: { price: true },
    _min: { price: true },
    _max: { price: true },
    _count: true,
  });

  // Şehir bazlı fiyat analizi (satılık)
  const cityPriceStats = [];
  for (const city of cities) {
    const stats = await prisma.listing.aggregate({
      where: { isFromOwner: true, status: "ACTIVE", cityId: city.id, listingType: "SALE", price: { not: null, gt: 0 } },
      _avg: { price: true },
      _min: { price: true },
      _max: { price: true },
      _count: true,
    });
    if (stats._count > 0) {
      cityPriceStats.push({
        city: city.name,
        avg: Math.round(stats._avg.price || 0),
        min: stats._min.price || 0,
        max: stats._max.price || 0,
        count: stats._count,
      });
    }
  }

  // İlçe bazlı ortalama fiyat (en çok ilanlı şehir)
  const topCity = byCityData[0];
  const topCityId = cities.find(c => c.name === topCity?.city)?.id;
  let districtPrices: Array<{ district: string; avg: number; count: number }> = [];
  if (topCityId) {
    const byDistrict = await prisma.listing.groupBy({
      by: ["district"],
      where: { isFromOwner: true, status: "ACTIVE", cityId: topCityId, listingType: "SALE", price: { not: null, gt: 0 } },
      _avg: { price: true },
      _count: true,
    });
    districtPrices = byDistrict
      .filter(d => d.district && d._count >= 2)
      .map(d => ({
        district: d.district!,
        avg: Math.round(d._avg.price || 0),
        count: d._count,
      }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 15);
  }

  // Emlakçı filtreleme başarı oranı
  const totalScraped = await prisma.listing.count();
  const filteredOut = await prisma.listing.count({ where: { isFromOwner: false } });
  const filterRate = totalScraped > 0 ? Math.round((filteredOut / totalScraped) * 100) : 0;

  return NextResponse.json({
    byCity: byCityData,
    byCategory: byCategoryData,
    byStatus: byStatusData,
    byType: byTypeData,
    recentScrapes,
    priceStats: {
      avg: Math.round(priceStats._avg.price || 0),
      min: priceStats._min.price || 0,
      max: priceStats._max.price || 0,
      count: priceStats._count,
    },
    cityPriceStats,
    districtPrices: { city: topCity?.city || "", data: districtPrices },
    filterStats: { total: totalScraped, filtered: filteredOut, rate: filterRate },
  });
}
