import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const cityId = searchParams.get("cityId");
  const categoryId = searchParams.get("categoryId");
  const listingType = searchParams.get("listingType");
  const isFromOwner = searchParams.get("isFromOwner");
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = {};

  if (cityId) where.cityId = cityId;
  if (categoryId) where.categoryId = categoryId;
  if (listingType) where.listingType = listingType;
  if (isFromOwner !== null && isFromOwner !== undefined && isFromOwner !== "") {
    where.isFromOwner = isFromOwner === "true";
  }
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { location: { contains: search, mode: "insensitive" } },
    ];
  }

  const [listings, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      include: { city: true, category: true, _count: { select: { assignments: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.listing.count({ where }),
  ]);

  return NextResponse.json({
    listings,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  // Toplu güncelleme: { ids: [...], status: "..." }
  if (body.ids && Array.isArray(body.ids)) {
    const result = await prisma.listing.updateMany({
      where: { id: { in: body.ids } },
      data: {
        ...(body.status && { status: body.status }),
        ...(body.categoryId && { categoryId: body.categoryId }),
      },
    });
    return NextResponse.json({ updated: result.count });
  }

  // Tekil güncelleme: { id: "...", status: "..." }
  const { id, status: newStatus, categoryId } = body;
  if (!id) return NextResponse.json({ error: "ID gerekli" }, { status: 400 });

  const updated = await prisma.listing.update({
    where: { id },
    data: {
      ...(newStatus && { status: newStatus }),
      ...(categoryId && { categoryId }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const ids = searchParams.get("ids");

  // Toplu silme: ?ids=id1,id2,id3
  if (ids) {
    const idList = ids.split(",").filter(Boolean);
    const result = await prisma.listing.deleteMany({
      where: { id: { in: idList } },
    });
    return NextResponse.json({ deleted: result.count });
  }

  // Tekil silme
  if (!id) return NextResponse.json({ error: "ID gerekli" }, { status: 400 });

  await prisma.listing.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
