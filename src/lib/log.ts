import { prisma } from "./prisma";
import { headers } from "next/headers";

export async function createLog(
  userId: string,
  action: string,
  details?: string,
  ipAddress?: string
) {
  // IP adresini otomatik al (verilmemişse)
  let ip = ipAddress;
  if (!ip) {
    try {
      const headersList = headers();
      ip = headersList.get("x-client-ip")
        || headersList.get("x-forwarded-for")?.split(",")[0]?.trim()
        || headersList.get("x-real-ip")
        || undefined;
    } catch {
      // headers() sadece server context'te çalışır
    }
  }

  await prisma.userLog.create({
    data: { userId, action, details, ipAddress: ip },
  });
}
