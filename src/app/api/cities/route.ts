import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { createLog } from "@/lib/log";
import { createCitySchema, validateBody } from "@/lib/validations";

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
  const validation = validateBody(createCitySchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { name, sahibindenCityId } = validation.data;

  const slug = slugify(name);
  const existing = await prisma.city.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "Bu şehir zaten mevcut" }, { status: 409 });
  }

  const city = await prisma.city.create({
    data: { name, slug, sahibindenCityId },
  });

  await createLog(session.user.id, "CITY_CREATED", `Şehir eklendi: ${name}`);
  return NextResponse.json(city, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, isActive } = await req.json();
  if (!id || typeof isActive !== "boolean") {
    return NextResponse.json({ error: "id ve isActive gerekli" }, { status: 400 });
  }

  try {
    const updated = await prisma.city.update({
      where: { id },
      data: { isActive },
    });
    await createLog(session.user.id, "CITY_UPDATED", `${updated.name} ${isActive ? "aktif" : "pasif"} yapıldı`);
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Şehir bulunamadı" }, { status: 404 });
  }
}
