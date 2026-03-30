import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Musteri tercihlerini getir
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const userId = session.user.role === "ADMIN" ? searchParams.get("userId") || session.user.id : session.user.id;

  const prefs = await prisma.customerPreference.findUnique({
    where: { userId },
  });

  return NextResponse.json(prefs);
}

// Tercihleri kaydet/guncelle
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const userId = session.user.role === "ADMIN" && body.userId ? body.userId : session.user.id;

  const { cityIds, categoryIds, listingType, priceMin, priceMax, autoAssign } = body;

  const prefs = await prisma.customerPreference.upsert({
    where: { userId },
    create: {
      userId,
      cityIds: cityIds || [],
      categoryIds: categoryIds || [],
      listingType: listingType || null,
      priceMin: priceMin || null,
      priceMax: priceMax || null,
      autoAssign: autoAssign || false,
    },
    update: {
      ...(cityIds !== undefined && { cityIds }),
      ...(categoryIds !== undefined && { categoryIds }),
      ...(listingType !== undefined && { listingType }),
      ...(priceMin !== undefined && { priceMin }),
      ...(priceMax !== undefined && { priceMax }),
      ...(autoAssign !== undefined && { autoAssign }),
    },
  });

  return NextResponse.json(prefs);
}
