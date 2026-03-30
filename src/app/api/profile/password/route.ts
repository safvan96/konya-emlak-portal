import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createLog } from "@/lib/log";
import { changePasswordSchema, validateBody } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limiting: 5 deneme / 15 dakika
  const rl = rateLimit(`password:${session.user.id}`, 5, 15 * 60 * 1000);
  if (!rl.success) {
    return NextResponse.json({ error: "Çok fazla deneme. 15 dakika bekleyin." }, { status: 429 });
  }

  const body = await req.json();
  const validation = validateBody(changePasswordSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { currentPassword, newPassword } = validation.data;

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });

  const isValid = await bcrypt.compare(currentPassword, user.password);
  if (!isValid) {
    return NextResponse.json({ error: "Mevcut şifre yanlış" }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { password: hashedPassword },
  });

  await createLog(session.user.id, "PASSWORD_CHANGED", "Şifre değiştirildi");

  return NextResponse.json({ success: true });
}
