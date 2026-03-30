"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, Link2, Bot, Heart, CalendarCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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
  CITY_UPDATED: "Şehir Güncelleme",
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
