"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Heart, Bell, Eye } from "lucide-react";
import Link from "next/link";
import { formatPrice, formatDate } from "@/lib/utils";

interface DashboardData {
  totalAssigned: number;
  totalFavorites: number;
  unread: number;
  notifications: number;
  recentAssignments: Array<{
    id: string;
    assignedAt: string;
    listing: { id: string; title: string; price: number | null; city: { name: string } };
  }>;
}

export default function CustomerDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/assignments").then((r) => r.ok ? r.json() : []),
      fetch("/api/favorites").then((r) => r.ok ? r.json() : []),
      fetch("/api/assignments/unread").then((r) => r.ok ? r.json() : { unread: 0 }),
      fetch("/api/notifications").then((r) => r.ok ? r.json() : []),
    ]).then(([assignments, favorites, unread, notifications]) => {
      setData({
        totalAssigned: assignments.length,
        totalFavorites: favorites.length,
        unread: unread.unread,
        notifications: notifications.length,
        recentAssignments: assignments.slice(0, 5),
      });
    });
  }, []);

  if (!data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Hosgeldiniz</h1>

      <div className="grid gap-4 md:grid-cols-4">
        <Link href="/my-listings">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <Building2 className="h-8 w-8 text-[var(--primary)]" />
              <div>
                <p className="text-2xl font-bold">{data.totalAssigned}</p>
                <p className="text-xs text-[var(--muted-foreground)]">Atanmis Ilan</p>
              </div>
              {data.unread > 0 && <Badge variant="destructive" className="ml-auto">{data.unread} yeni</Badge>}
            </CardContent>
          </Card>
        </Link>
        <Link href="/favorites">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <Heart className="h-8 w-8 text-red-400" />
              <div>
                <p className="text-2xl font-bold">{data.totalFavorites}</p>
                <p className="text-xs text-[var(--muted-foreground)]">Favori</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/notifications">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <Bell className="h-8 w-8 text-orange-400" />
              <div>
                <p className="text-2xl font-bold">{data.notifications}</p>
                <p className="text-xs text-[var(--muted-foreground)]">Bildirim</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/history">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <Eye className="h-8 w-8 text-[var(--muted-foreground)]" />
              <div>
                <p className="text-xs text-[var(--muted-foreground)]">Goruntuleme Gecmisi</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Son Atanan Ilanlar */}
      {data.recentAssignments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Son Atanan Ilanlar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.recentAssignments.map((a) => (
                <Link
                  key={a.id}
                  href={`/my-listings/${a.listing.id}`}
                  className="flex items-center justify-between rounded-md border border-[var(--border)] px-3 py-2 hover:bg-[var(--accent)] transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{a.listing.title}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">{a.listing.city.name} - {formatDate(a.assignedAt)}</p>
                  </div>
                  <span className="text-sm font-bold text-[var(--primary)] shrink-0 ml-3">
                    {formatPrice(a.listing.price)}
                  </span>
                </Link>
              ))}
            </div>
            {data.totalAssigned > 5 && (
              <Link href="/my-listings" className="block text-center text-sm text-[var(--primary)] hover:underline mt-3">
                Tum ilanlari gor ({data.totalAssigned})
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
