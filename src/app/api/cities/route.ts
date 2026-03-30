import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cities = await prisma.city.findMany({
    include: { _count: { select: { listings: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(cities);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, sahibindenCityId } = body;

  if (!name) return NextResponse.json({ error: "Şehir adı gerekli" }, { status: 400 });

  const city = await prisma.city.create({
    data: {
      name,
      slug: slugify(name),
      sahibindenCityId: sahibindenCityId || null,
    },
  });

  return NextResponse.json(city);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, isActive } = body;

  const updated = await prisma.city.update({
    where: { id },
    data: { isActive },
  });

  return NextResponse.json(updated);
}
