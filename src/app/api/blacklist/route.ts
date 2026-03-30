import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { blacklistKeywordSchema, validateBody } from "@/lib/validations";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keywords = await prisma.blacklistKeyword.findMany({
    orderBy: { keyword: "asc" },
  });

  return NextResponse.json(keywords);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const validation = validateBody(blacklistKeywordSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const normalized = validation.data.keyword.trim().toLowerCase();

  const existing = await prisma.blacklistKeyword.findUnique({
    where: { keyword: normalized },
  });

  if (existing) {
    return NextResponse.json({ error: "Bu kelime zaten mevcut" }, { status: 409 });
  }

  const created = await prisma.blacklistKeyword.create({
    data: { keyword: normalized },
  });

  return NextResponse.json(created, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "ID gerekli" }, { status: 400 });

  await prisma.blacklistKeyword.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
