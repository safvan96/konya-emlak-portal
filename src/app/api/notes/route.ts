import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Musterinin bir ilana notu
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const listingId = searchParams.get("listingId");

  if (!listingId) return NextResponse.json({ error: "listingId gerekli" }, { status: 400 });

  const note = await prisma.listingNote.findUnique({
    where: { userId_listingId: { userId: session.user.id, listingId } },
  });

  return NextResponse.json(note);
}

// Not ekle veya guncelle
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { listingId, content } = await req.json();

  if (!listingId || typeof content !== "string") {
    return NextResponse.json({ error: "listingId ve content gerekli" }, { status: 400 });
  }

  if (content.trim() === "") {
    // Bos not = sil
    await prisma.listingNote.deleteMany({
      where: { userId: session.user.id, listingId },
    });
    return NextResponse.json({ deleted: true });
  }

  const note = await prisma.listingNote.upsert({
    where: { userId_listingId: { userId: session.user.id, listingId } },
    create: { userId: session.user.id, listingId, content: content.trim() },
    update: { content: content.trim() },
  });

  return NextResponse.json(note);
}
