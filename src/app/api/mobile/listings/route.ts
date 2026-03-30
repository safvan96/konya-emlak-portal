import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Mobil icin optimize edilmis ilan API - daha az veri, daha hizli
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");

  if (session.user.role === "CUSTOMER") {
    // Musteri: sadece atanmis ilanlar
    const assignments = await prisma.assignment.findMany({
      where: { userId: session.user.id },
      include: {
        listing: {
          select: {
            id: true, title: true, price: true, listingType: true,
            district: true, roomCount: true, squareMeters: true,
            imageUrls: true, sourceUrl: true,
            city: { select: { name: true } },
            category: { select: { name: true } },
          },
        },
      },
      orderBy: { assignedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await prisma.assignment.count({ where: { userId: session.user.id } });

    return NextResponse.json({
      listings: assignments.map((a) => ({
        ...a.listing,
        // Sadece ilk resim (mobil bant genisligi icin)
        imageUrl: a.listing.imageUrls[0] || null,
        imageUrls: undefined,
      })),
      page, limit, total, totalPages: Math.ceil(total / limit),
    });
  }

  // Admin: tum ilanlar
  const [listings, total] = await Promise.all([
    prisma.listing.findMany({
      where: { isFromOwner: true, status: "ACTIVE" },
      select: {
        id: true, title: true, price: true, listingType: true,
        district: true, roomCount: true, squareMeters: true,
        imageUrls: true,
        city: { select: { name: true } },
        category: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.listing.count({ where: { isFromOwner: true, status: "ACTIVE" } }),
  ]);

  return NextResponse.json({
    listings: listings.map((l) => ({
      ...l,
      imageUrl: l.imageUrls[0] || null,
      imageUrls: undefined,
    })),
    page, limit, total, totalPages: Math.ceil(total / limit),
  });
}
