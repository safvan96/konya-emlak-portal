import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      db: "connected",
    });
  } catch {
    return NextResponse.json(
      { status: "error", db: "disconnected", timestamp: new Date().toISOString() },
      { status: 503 }
    );
  }
}
