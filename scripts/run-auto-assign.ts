import { autoAssignListings } from "../src/lib/auto-assign";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Otomatik atama çalıştırılıyor...\n");
  await autoAssignListings();

  const stats = await prisma.user.findMany({
    where: { role: "CUSTOMER" },
    select: {
      name: true, surname: true, email: true,
      _count: { select: { assignments: true } },
    },
    orderBy: { email: "asc" },
  });

  console.log("\nMüşteri ilan sayıları:");
  stats.forEach(s =>
    console.log(`  ${s.name} ${s.surname} (${s.email}): ${s._count.assignments} ilan`)
  );

  await prisma.$disconnect();
  process.exit(0);
}

main();
