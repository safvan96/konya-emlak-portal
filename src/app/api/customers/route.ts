import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createCustomerSchema, updateCustomerSchema, validateBody } from "@/lib/validations";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const customers = await prisma.user.findMany({
    where: { role: "CUSTOMER" },
    select: {
      id: true,
      email: true,
      name: true,
      surname: true,
      isActive: true,
      createdAt: true,
      _count: { select: { assignments: true, favorites: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(customers);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const validation = validateBody(createCustomerSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { email, password, name, surname } = validation.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Bu email zaten kayıtlı" }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const customer = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      surname,
      role: "CUSTOMER",
    },
  });

  return NextResponse.json({
    id: customer.id,
    email: customer.email,
    name: customer.name,
    surname: customer.surname,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const validation = validateBody(updateCustomerSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { id, name, surname, email, isActive, password } = validation.data;

  const data: Record<string, unknown> = {};
  if (name) data.name = name;
  if (surname) data.surname = surname;
  if (email) data.email = email;
  if (isActive !== undefined) data.isActive = isActive;
  if (password) data.password = await bcrypt.hash(password, 12);

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, email: true, name: true, surname: true, isActive: true },
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

  if (!id) return NextResponse.json({ error: "ID gerekli" }, { status: 400 });

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
