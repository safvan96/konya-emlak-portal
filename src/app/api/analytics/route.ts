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
  });
}
