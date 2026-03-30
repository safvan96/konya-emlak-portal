import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// CSV format: Ad,Soyad,Email,Sifre
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return NextResponse.json({ error: "CSV dosyasi gerekli" }, { status: 400 });
  }

  const text = await file.text();
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // Ilk satir header olabilir - atla
  const startIndex = lines[0]?.toLowerCase().includes("email") ? 1 : 0;

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const parts = lines[i].split(",").map((p) => p.replace(/"/g, "").trim());

    if (parts.length < 4) {
      errors.push(`Satir ${i + 1}: Eksik alan`);
      continue;
    }

    const [name, surname, email, password] = parts;

    if (!name || !surname || !email || !password) {
      errors.push(`Satir ${i + 1}: Bos alan`);
      continue;
    }

    // Email format kontrolu
    if (!email.includes("@")) {
      errors.push(`Satir ${i + 1}: Gecersiz email: ${email}`);
      continue;
    }

    // Var mi kontrol
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      skipped++;
      continue;
    }

    try {
      await prisma.user.create({
        data: {
          name,
          surname,
          email,
          password: await bcrypt.hash(password, 12),
          role: "CUSTOMER",
        },
      });
      created++;
    } catch (err) {
      errors.push(`Satir ${i + 1}: ${email} eklenemedi`);
    }
  }

  return NextResponse.json({
    created,
    skipped,
    errors: errors.length,
    errorDetails: errors.slice(0, 10),
    total: lines.length - startIndex,
  });
}
