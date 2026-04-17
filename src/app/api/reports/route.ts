import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "week"; // week, month, all

  const now = new Date();
  const since = new Date();
  if (period === "week") since.setDate(now.getDate() - 7);
  else if (period === "month") since.setDate(now.getDate() - 30);
  else since.setFullYear(2020);

  const [
    newListings,
    rejectedListings,
    newCustomers,
    totalAssignments,
    totalFavorites,
    logins,
    listingViews,
    scraperRuns,
    priceChanges,
    topViewedListings,
    activeCustomers,
  ] = await Promise.all([
    prisma.listing.count({ where: { createdAt: { gte: since }, isFromOwner: true } }),
    prisma.listing.count({ where: { createdAt: { gte: since }, isFromOwner: false } }),
    prisma.user.count({ where: { createdAt: { gte: since }, role: "CUSTOMER" } }),
    prisma.assignment.count({ where: { assignedAt: { gte: since } } }),
    prisma.favorite.count({ where: { createdAt: { gte: since } } }),
    prisma.userLog.count({ where: { createdAt: { gte: since }, action: "LOGIN" } }),
    prisma.userLog.count({ where: { createdAt: { gte: since }, action: "VIEW_LISTING" } }),
    prisma.scraperRun.findMany({
      where: { startedAt: { gte: since }, status: "completed" },
      select: { accepted: true, rejected: true, duplicates: true },
    }),
    prisma.priceHistory.count({ where: { changedAt: { gte: since } } }),
    // En cok goruntulenen ilanlar
    prisma.userLog.groupBy({
      by: ["details"],
      where: { action: "VIEW_LISTING", createdAt: { gte: since } },
      _count: true,
      orderBy: { _count: { details: "desc" } },
      take: 5,
    }),
    // En aktif musteriler (login sayisina gore)
    prisma.userLog.groupBy({
      by: ["userId"],
      where: { action: "LOGIN", createdAt: { gte: since } },
      _count: true,
      orderBy: { _count: { userId: "desc" } },
      take: 5,
    }),
  ]);

  // Scraper toplam
  const scraperTotals = scraperRuns.reduce(
    (acc, r) => ({ accepted: acc.accepted + r.accepted, rejected: acc.rejected + r.rejected, duplicates: acc.duplicates + r.duplicates }),
    { accepted: 0, rejected: 0, duplicates: 0 }
  );

  // Aktif musteri isimlerini cek
  const activeCustomerIds = activeCustomers.map((c) => c.userId);
  const customerNames = await prisma.user.findMany({
    where: { id: { in: activeCustomerIds } },
    select: { id: true, name: true, surname: true },
  });
  const nameMap = Object.fromEntries(customerNames.map((c) => [c.id, `${c.name} ${c.surname}`]));

  return NextResponse.json({
    period,
    summary: {
      newListings,
      rejectedListings,
      newCustomers,
      totalAssignments,
      totalFavorites,
      logins,
      listingViews,
      priceChanges,
      scraperRuns: scraperRuns.length,
      scraperTotals,
    },
    topViewedListings: topViewedListings.map((t) => ({
      title: t.details?.replace("İlan görüntülendi: ", "") || "Bilinmiyor",
      views: t._count,
    })),
    activeCustomers: activeCustomers.map((c) => ({
      name: nameMap[c.userId] || c.userId,
      logins: c._count,
    })),
  });
}
