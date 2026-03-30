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
  });
}
