import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Toplu ilan islemleri
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { action, ids, categoryId, status } = await req.json();

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids gerekli" }, { status: 400 });
  }

  switch (action) {
    case "changeCategory": {
      if (!categoryId) return NextResponse.json({ error: "categoryId gerekli" }, { status: 400 });
      const result = await prisma.listing.updateMany({
        where: { id: { in: ids } },
        data: { categoryId },
      });
      return NextResponse.json({ updated: result.count, action: "changeCategory" });
    }

    case "changeStatus": {
      if (!status) return NextResponse.json({ error: "status gerekli" }, { status: 400 });
      const result = await prisma.listing.updateMany({
        where: { id: { in: ids } },
        data: { status },
      });
      return NextResponse.json({ updated: result.count, action: "changeStatus" });
    }

    case "delete": {
      const result = await prisma.listing.deleteMany({
        where: { id: { in: ids } },
      });
      return NextResponse.json({ deleted: result.count, action: "delete" });
    }

    case "refilter": {
      // Secili ilanlari tekrar filtrele
      const { filterListing } = await import("@/lib/scraper/filter");
      let updated = 0;
      for (const id of ids) {
        const listing = await prisma.listing.findUnique({ where: { id } });
        if (!listing) continue;
        const result = await filterListing(listing.description, undefined);
        await prisma.listing.update({
          where: { id },
          data: {
            isFromOwner: result.isFromOwner,
            rejectionReason: result.rejectionReason,
            status: result.isFromOwner ? "ACTIVE" : "PASSIVE",
          },
        });
        updated++;
      }
      return NextResponse.json({ updated, action: "refilter" });
    }

    default:
      return NextResponse.json({ error: "Gecersiz action" }, { status: 400 });
  }
}
