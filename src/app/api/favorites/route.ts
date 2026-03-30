import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLog } from "@/lib/log";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const favorites = await prisma.favorite.findMany({
    where: { userId: session.user.id },
    include: {
      listing: { include: { city: true, category: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(favorites);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { listingId } = await req.json();
  if (!listingId) {
    return NextResponse.json({ error: "listingId gerekli" }, { status: 400 });
  }

  // İlan var mı kontrol
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) {
    return NextResponse.json({ error: "İlan bulunamadı" }, { status: 404 });
  }

  // Zaten favori mi?
  const existing = await prisma.favorite.findUnique({
    where: { userId_listingId: { userId: session.user.id, listingId } },
  });
  if (existing) {
    return NextResponse.json({ error: "Zaten favorilerde" }, { status: 409 });
  }

  const fav = await prisma.favorite.create({
    data: { userId: session.user.id, listingId },
  });

  await createLog(session.user.id, "FAVORITE_ADD", `Favorilere eklendi: ${listing.title}`);
  return NextResponse.json(fav, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const listingId = searchParams.get("listingId");

  if (!listingId) return NextResponse.json({ error: "listingId gerekli" }, { status: 400 });

  const deleted = await prisma.favorite.deleteMany({
    where: { userId: session.user.id, listingId },
  });

  if (deleted.count > 0) {
    await createLog(session.user.id, "FAVORITE_REMOVE", `Favorilerden çıkarıldı: ${listingId}`);
  }

  return NextResponse.json({ success: true });
}
