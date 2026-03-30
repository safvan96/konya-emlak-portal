import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLog } from "@/lib/log";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const listing = await prisma.listing.findUnique({
    where: { id: params.id },
    include: {
      city: true,
      category: true,
      assignments: {
        include: { user: { select: { id: true, name: true, surname: true, email: true } } },
      },
      _count: { select: { assignments: true, favorites: true } },
    },
  });

  if (!listing) {
    return NextResponse.json({ error: "İlan bulunamadı" }, { status: 404 });
  }

  // Müşteri sadece kendisine atanmış ilanı görebilir
  if (session.user.role === "CUSTOMER") {
    const assignment = await prisma.assignment.findFirst({
      where: { userId: session.user.id, listingId: listing.id },
    });
    if (!assignment) {
      return NextResponse.json({ error: "Bu ilana erişiminiz yok" }, { status: 403 });
    }
    // İlan görüntüleme logu
    await createLog(session.user.id, "VIEW_LISTING", `İlan görüntülendi: ${listing.title}`);
    // Müşteriye atama bilgileri gösterme
    const { assignments, ...rest } = listing;
    return NextResponse.json(rest);
  }

  return NextResponse.json(listing);
}
