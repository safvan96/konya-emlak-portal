"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, Link2, Bot } from "lucide-react";

interface Stats {
  totalListings: number;
  ownerListings: number;
  totalCustomers: number;
  totalAssignments: number;
  lastScrape: { startedAt: string; status: string; accepted: number; rejected: number } | null;
  recentLogs: { id: string; action: string; details: string | null; createdAt: string; user: { name: string; surname: string } }[];
}

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
    return <div className="animate-pulse">Yükleniyor...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam İlan</CardTitle>
            <Building2 className="h-4 w-4 text-[var(--muted-foreground)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalListings}</div>
            <p className="text-xs text-[var(--muted-foreground)]">
              {stats.ownerListings} sahiplerinden
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Müşteriler</CardTitle>
            <Users className="h-4 w-4 text-[var(--muted-foreground)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCustomers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atamalar</CardTitle>
            <Link2 className="h-4 w-4 text-[var(--muted-foreground)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAssignments}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Son Scrape</CardTitle>
            <Bot className="h-4 w-4 text-[var(--muted-foreground)]" />
          </CardHeader>
          <CardContent>
            {stats.lastScrape ? (
              <>
                <div className="text-2xl font-bold">{stats.lastScrape.status}</div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  +{stats.lastScrape.accepted} kabul / -{stats.lastScrape.rejected} red
                </p>
              </>
            ) : (
              <div className="text-sm text-[var(--muted-foreground)]">Henüz çalışmadı</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Son Aktiviteler</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentLogs.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">Henüz aktivite yok</p>
          ) : (
            <div className="space-y-3">
              {stats.recentLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between border-b border-[var(--border)] pb-2 last:border-0">
                  <div>
                    <span className="font-medium text-sm">{log.user.name} {log.user.surname}</span>
                    <span className="mx-2 text-[var(--muted-foreground)]">-</span>
                    <span className="text-sm">{log.action}</span>
                    {log.details && (
                      <p className="text-xs text-[var(--muted-foreground)]">{log.details}</p>
                    )}
                  </div>
                  <span className="text-xs text-[var(--muted-foreground)]">
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
