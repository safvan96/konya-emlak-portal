"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2, Users, Link2, Heart, Eye, LogIn, Bot, TrendingDown,
  FileText, Trophy, Download,
} from "lucide-react";

interface Report {
  period: string;
  summary: {
    newListings: number;
    rejectedListings: number;
    newCustomers: number;
    totalAssignments: number;
    totalFavorites: number;
    logins: number;
    listingViews: number;
    priceChanges: number;
    scraperRuns: number;
    scraperTotals: { accepted: number; rejected: number; duplicates: number };
  };
  topViewedListings: Array<{ title: string; views: number }>;
  activeCustomers: Array<{ name: string; logins: number }>;
}

export default function ReportsPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [period, setPeriod] = useState("week");

  useEffect(() => {
    setReport(null);
    fetch(`/api/reports?period=${period}`)
      .then((r) => r.ok ? r.json() : null)
      .then(setReport);
  }, [period]);

  const periodLabel = period === "week" ? "Son 7 Gun" : period === "month" ? "Son 30 Gun" : "Tum Zamanlar";

  if (!report) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {[...Array(10)].map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>)}
        </div>
      </div>
    );
  }

  const s = report.summary;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-bold">Raporlar</h1>
        <div className="flex items-center gap-2">
          <a href="/api/reports/export?type=customers" download className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-3 py-2 text-xs hover:bg-[var(--accent)]">
            <Download className="h-3 w-3" /> Musteri Raporu
          </a>
          <a href="/api/reports/export?type=listings" download className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-3 py-2 text-xs hover:bg-[var(--accent)]">
            <Download className="h-3 w-3" /> Ilan Raporu
          </a>
          <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-44">
            <option value="week">Son 7 Gun</option>
            <option value="month">Son 30 Gun</option>
            <option value="all">Tum Zamanlar</option>
          </Select>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-[var(--muted-foreground)]">{periodLabel}</h2>

      {/* Ozet Metrikleri */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        <MetricCard icon={Building2} label="Yeni Ilan" value={s.newListings} sub={`${s.rejectedListings} reddedildi`} />
        <MetricCard icon={Users} label="Yeni Musteri" value={s.newCustomers} />
        <MetricCard icon={Link2} label="Atama" value={s.totalAssignments} />
        <MetricCard icon={Heart} label="Favori" value={s.totalFavorites} />
        <MetricCard icon={Eye} label="Goruntuleme" value={s.listingViews} />
        <MetricCard icon={LogIn} label="Giris" value={s.logins} />
        <MetricCard icon={TrendingDown} label="Fiyat Degisimi" value={s.priceChanges} />
        <MetricCard icon={Bot} label="Scraper" value={s.scraperRuns} sub={`+${s.scraperTotals.accepted} kabul`} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* En Cok Goruntulenen */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5" /> En Cok Goruntulenen</CardTitle>
          </CardHeader>
          <CardContent>
            {report.topViewedListings.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">Veri yok</p>
            ) : (
              <div className="space-y-2">
                {report.topViewedListings.map((l, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm truncate max-w-[250px]">{l.title}</span>
                    <Badge variant="secondary">{l.views} goruntulenme</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* En Aktif Musteriler */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> En Aktif Musteriler</CardTitle>
          </CardHeader>
          <CardContent>
            {report.activeCustomers.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">Veri yok</p>
            ) : (
              <div className="space-y-2">
                {report.activeCustomers.map((c, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{c.name}</span>
                    <Badge variant="secondary">{c.logins} giris</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Scraper Ozet */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Scraper Ozeti</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4 text-center">
            <div>
              <p className="text-2xl font-bold">{s.scraperRuns}</p>
              <p className="text-xs text-[var(--muted-foreground)]">Calistirma</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{s.scraperTotals.accepted}</p>
              <p className="text-xs text-[var(--muted-foreground)]">Kabul</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-500">{s.scraperTotals.rejected}</p>
              <p className="text-xs text-[var(--muted-foreground)]">Red</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--muted-foreground)]">{s.scraperTotals.duplicates}</p>
              <p className="text-xs text-[var(--muted-foreground)]">Tekrar</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, sub }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: number; sub?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="h-4 w-4 text-[var(--muted-foreground)]" />
          <span className="text-xs text-[var(--muted-foreground)]">{label}</span>
        </div>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-[var(--muted-foreground)]">{sub}</p>}
      </CardContent>
    </Card>
  );
}
