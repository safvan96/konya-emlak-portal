import { prisma } from "./prisma";

/**
 * Yeni eklenen ilanları müşteri tercihlerine göre otomatik atar.
 * Scraper tamamlandıktan sonra çağrılır.
 */
export async function autoAssignListings() {
  // autoAssign aktif olan müşteri tercihlerini al
  const preferences = await prisma.customerPreference.findMany({
    where: { autoAssign: true },
    include: { user: { select: { id: true, isActive: true } } },
  });

  if (preferences.length === 0) return;

  // Son 24 saatte eklenen aktif sahibinden ilanları
  const since = new Date();
  since.setHours(since.getHours() - 24);

  for (const pref of preferences) {
    if (!pref.user.isActive) continue;

    const where: Record<string, unknown> = {
      isFromOwner: true,
      status: "ACTIVE",
      createdAt: { gte: since },
    };

    if (pref.cityIds.length > 0) where.cityId = { in: pref.cityIds };
    if (pref.categoryIds.length > 0) where.categoryId = { in: pref.categoryIds };
    if (pref.listingType) where.listingType = pref.listingType;
    if (pref.priceMin || pref.priceMax) {
      where.price = {};
      if (pref.priceMin) (where.price as Record<string, number>).gte = pref.priceMin;
      if (pref.priceMax) (where.price as Record<string, number>).lte = pref.priceMax;
    }

    const matchingListings = await prisma.listing.findMany({
      where,
      select: { id: true },
    });

    if (matchingListings.length === 0) continue;

    // Zaten atanmış olanları filtrele
    const existingAssignments = await prisma.assignment.findMany({
      where: {
        userId: pref.userId,
        listingId: { in: matchingListings.map((l) => l.id) },
      },
      select: { listingId: true },
    });

    const existingIds = new Set(existingAssignments.map((a) => a.listingId));
    const newListingIds = matchingListings
      .filter((l) => !existingIds.has(l.id))
      .map((l) => l.id);

    if (newListingIds.length === 0) continue;

    await prisma.assignment.createMany({
      data: newListingIds.map((listingId) => ({
        userId: pref.userId,
        listingId,
        assignedBy: "system-auto",
      })),
      skipDuplicates: true,
    });

    console.log(`Otomatik atama: ${pref.user.id} -> ${newListingIds.length} ilan`);
  }
}
