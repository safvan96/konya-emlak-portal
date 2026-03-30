import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [totalListings, ownerListings, totalCustomers, totalAssignments, lastScrape, recentLogs] =
    await Promise.all([
      prisma.listing.count(),
      prisma.listing.count({ where: { isFromOwner: true } }),
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      prisma.assignment.count(),
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
    totalCustomers,
    totalAssignments,
    lastScrape,
    recentLogs,
  });
}
