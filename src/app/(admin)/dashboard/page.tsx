"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, Link2, Bot, Heart, CalendarCheck, TrendingDown, Sparkles } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/utils";

interface Stats {
  totalListings: number;
  ownerListings: number;
  activeListings: number;
  totalCustomers: number;
  activeCustomers: number;
  totalAssignments: number;
  todayAssignments: number;
  totalFavorites: number;
  lastScrape: { startedAt: string; status: string; accepted: number; rejected: number } | null;
  recentLogs: { id: string; action: string; details: string | null; createdAt: string; user: { name: string; surname: string } }[];
  newListingsSinceLogin: number;
  priceDrops: Array<{ oldPrice: number; newPrice: number; changedAt: string; listing: { id: string; title: string; city: { name: string } } }>;
}

const ACTION_LABELS: Record<string, string> = {
  LOGIN: "Giriş",
  LOGOUT: "Çıkış",
  VIEW_LISTING: "İlan Görüntüleme",
  ASSIGN_LISTINGS: "İlan Atama",
  REMOVE_ASSIGNMENT: "Atama Kaldırma",
  SCRAPER_TRIGGERED: "Scraper Tetikleme",
  FAVORITE_ADD: "Favorilere Ekleme",
  FAVORITE_REMOVE: "Favorilerden Çıkarma",
  PASSWORD_CHANGED: "Şifre Değişikliği",
  CITY_CREATED: "Şehir Ekleme",
  CITY_UPDATED: "Sehir Guncelleme",
  ADMIN_NOTIFICATION: "Admin Bildirimi",
  SEND_NOTIFICATION: "Bildirim Gonderme",
  FORCE_DEACTIVATE: "Zorla Deaktif",
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    const res = await fetch("/api/dashboard");
    if (res.ok) setStats(await res.json());
  }

  if (!stats) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-16" /></CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
          <CardContent className="space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Toplam İlan"
          value={stats.totalListings}
          sub={`${stats.activeListings} aktif sahibinden`}
          icon={Building2}
        />
        <StatCard
          title="Sahibinden"
          value={stats.ownerListings}
          sub={`${stats.totalListings - stats.ownerListings} emlakçı`}
          icon={Building2}
        />
        <StatCard
          title="Müşteriler"
          value={stats.totalCustomers}
          sub={`${stats.activeCustomers} aktif`}
          icon={Users}
        />
        <StatCard
          title="Atamalar"
          value={stats.totalAssignments}
          sub={`${stats.todayAssignments} bugün`}
          icon={Link2}
        />
        <StatCard
          title="Favoriler"
          value={stats.totalFavorites}
          icon={Heart}
        />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Son Scrape</CardTitle>
            <Bot className="h-4 w-4 text-[var(--muted-foreground)]" />
          </CardHeader>
          <CardContent>
            {stats.lastScrape ? (
              <>
                <Badge variant={stats.lastScrape.status === "completed" ? "success" : stats.lastScrape.status === "running" ? "warning" : "destructive"} className="mb-1">
                  {stats.lastScrape.status === "completed" ? "Tamamlandı" : stats.lastScrape.status === "running" ? "Çalışıyor" : "Hata"}
                </Badge>
                <p className="text-xs text-[var(--muted-foreground)]">
                  +{stats.lastScrape.accepted} / -{stats.lastScrape.rejected}
                </p>
              </>
            ) : (
              <div className="text-sm text-[var(--muted-foreground)]">Henüz yok</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bildirimler */}
      <div className="grid gap-4 md:grid-cols-2">
        {stats.newListingsSinceLogin > 0 && (
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="p-4 flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-green-800">
                  Son girisimden beri <span className="text-lg">{stats.newListingsSinceLogin}</span> yeni ilan eklendi
                </p>
                <Link href="/listings" className="text-xs text-green-600 hover:underline">Ilanlari gor →</Link>
              </div>
            </CardContent>
          </Card>
        )}

        {stats.priceDrops.length > 0 && (
          <Card className="border-orange-200 bg-orange-50/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="h-5 w-5 text-orange-600" />
                <span className="font-medium text-orange-800">Fiyat Dususleri (Son 7 Gun)</span>
              </div>
              <div className="space-y-1">
                {stats.priceDrops.slice(0, 5).map((p, i) => (
                  <Link key={i} href={`/listings/${p.listing.id}`} className="flex items-center justify-between text-sm hover:bg-orange-100 rounded px-1 py-0.5">
                    <span className="truncate max-w-[200px]">{p.listing.title}</span>
                    <span className="shrink-0 ml-2">
                      <span className="text-red-500 line-through text-xs">{formatPrice(p.oldPrice)}</span>
                      <span className="text-green-600 font-medium ml-1 text-xs">{formatPrice(p.newPrice)}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5" />
            Son Aktiviteler
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentLogs.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">Henüz aktivite yok</p>
          ) : (
            <div className="space-y-3">
              {stats.recentLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between border-b border-[var(--border)] pb-2 last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{log.user.name} {log.user.surname}</span>
                      <Badge variant="outline" className="text-xs">{ACTION_LABELS[log.action] || log.action}</Badge>
                    </div>
                    {log.details && (
                      <p className="text-xs text-[var(--muted-foreground)] truncate">{log.details}</p>
                    )}
                  </div>
                  <span className="text-xs text-[var(--muted-foreground)] shrink-0 ml-4">
                    {new Date(log.createdAt).toLocaleString("tr-TR")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
}: {
  title: string;
  value: number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-[var(--muted-foreground)]" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <p className="text-xs text-[var(--muted-foreground)]">{sub}</p>}
      </CardContent>
    </Card>
  );
}
