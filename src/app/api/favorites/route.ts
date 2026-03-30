import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const body = await req.json();
  const { listingId } = body;

  try {
    const fav = await prisma.favorite.create({
      data: { userId: session.user.id, listingId },
    });
    return NextResponse.json(fav);
  } catch {
    // Zaten favori
    return NextResponse.json({ error: "Zaten favorilerde" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const listingId = searchParams.get("listingId");

  if (!listingId) return NextResponse.json({ error: "listingId gerekli" }, { status: 400 });

  await prisma.favorite.deleteMany({
    where: { userId: session.user.id, listingId },
  });

  return NextResponse.json({ success: true });
}
