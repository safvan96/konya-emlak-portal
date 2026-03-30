import { prisma } from "./prisma";

export async function createLog(
  userId: string,
  action: string,
  details?: string,
  ipAddress?: string
) {
  await prisma.userLog.create({
    data: { userId, action, details, ipAddress },
  });
}
