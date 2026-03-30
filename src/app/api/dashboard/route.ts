import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Admin'in son login zamani
  const lastLogin = await prisma.userLog.findFirst({
    where: { userId: session.user.id, action: "LOGIN" },
    orderBy: { createdAt: "desc" },
    skip: 1, // Mevcut oturumu atla
  });

  const sinceLastLogin = lastLogin?.createdAt || today;

  const [
    totalListings,
    ownerListings,
    activeListings,
    totalCustomers,
    activeCustomers,
    totalAssignments,
    todayAssignments,
    totalFavorites,
    lastScrape,
    recentLogs,
    newListingsSinceLogin,
    priceDrops,
  ] = await Promise.all([
    prisma.listing.count(),
    prisma.listing.count({ where: { isFromOwner: true } }),
    prisma.listing.count({ where: { status: "ACTIVE", isFromOwner: true } }),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.user.count({ where: { role: "CUSTOMER", isActive: true } }),
    prisma.assignment.count(),
    prisma.assignment.count({ where: { assignedAt: { gte: today } } }),
    prisma.favorite.count(),
    prisma.scraperRun.findFirst({ orderBy: { startedAt: "desc" } }),
    prisma.userLog.findMany({
      include: { user: { select: { name: true, surname: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    // Son giristen beri yeni ilanlar
    prisma.listing.count({
      where: { createdAt: { gte: sinceLastLogin }, isFromOwner: true },
    }),
    // Son 7 gundeki fiyat dususleri
    prisma.priceHistory.findMany({
      where: {
        changedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      include: {
        listing: { select: { id: true, title: true, city: { select: { name: true } } } },
      },
      orderBy: { changedAt: "desc" },
      take: 10,
    }),
  ]);

  return NextResponse.json({
    totalListings,
    ownerListings,
    activeListings,
    totalCustomers,
    activeCustomers,
    totalAssignments,
    todayAssignments,
    totalFavorites,
    lastScrape,
    recentLogs,
    newListingsSinceLogin,
    priceDrops: priceDrops.filter((p) => p.newPrice !== null && p.oldPrice !== null && p.newPrice < p.oldPrice),
  });
}
