"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, TrendingUp, MapPin, Tag, PieChart } from "lucide-react";

interface Analytics {
  byCity: Array<{ city: string; count: number }>;
  byCategory: Array<{ category: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
  byType: Array<{ type: string; count: number }>;
  recentScrapes: Array<{ startedAt: string; accepted: number; rejected: number; duplicates: number }>;
  priceStats: { avg: number; min: number; max: number; count: number };
  cityPriceStats?: Array<{ city: string; avg: number; min: number; max: number; count: number }>;
  districtPrices?: { city: string; data: Array<{ district: string; avg: number; count: number }> };
  filterStats?: { total: number; filtered: number; rate: number };
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    fetch("/api/analytics").then((r) => r.ok ? r.json() : null).then(setData);
  }, []);

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Istatistikler</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  const totalByStatus = data.byStatus.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Istatistikler</h1>

      {/* Fiyat Istatistikleri */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-[var(--muted-foreground)]">Ortalama Fiyat</p>
            <p className="text-xl font-bold text-[var(--primary)]">{formatPrice(data.priceStats.avg)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-[var(--muted-foreground)]">En Dusuk</p>
            <p className="text-xl font-bold text-green-600">{formatPrice(data.priceStats.min)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-[var(--muted-foreground)]">En Yuksek</p>
            <p className="text-xl font-bold text-red-500">{formatPrice(data.priceStats.max)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-[var(--muted-foreground)]">Aktif İlan</p>
            <p className="text-xl font-bold">{data.priceStats.count}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Durum Dagilimi */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PieChart className="h-5 w-5" /> Durum Dagilimi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.byStatus.map((item) => (
              <div key={item.status} className="flex items-center justify-between">
                <span className="text-sm">{item.status}</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-[var(--muted)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--primary)] rounded-full"
                      style={{ width: `${totalByStatus ? (item.count / totalByStatus) * 100 : 0}%` }}
                    />
                  </div>
                  <Badge variant="secondary">{item.count}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Tip Dagilimi */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Satilik / Kiralik</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.byType.map((item) => {
              const total = data.byType.reduce((s, t) => s + t.count, 0);
              return (
                <div key={item.type} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{item.type}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-[var(--muted)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--primary)] rounded-full"
                        style={{ width: `${total ? (item.count / total) * 100 : 0}%` }}
                      />
                    </div>
                    <Badge variant="secondary">{item.count}</Badge>
                    <span className="text-xs text-[var(--muted-foreground)]">
                      %{total ? Math.round((item.count / total) * 100) : 0}
                    </span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Sehir Bazli */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" /> Sehir Bazli (Aktif)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.byCity.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">Veri yok</p>
            ) : data.byCity.map((item) => (
              <div key={item.city} className="flex items-center justify-between">
                <span className="text-sm">{item.city}</span>
                <Badge variant="secondary">{item.count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Kategori Bazli */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Tag className="h-5 w-5" /> Kategori Bazli (Aktif)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.byCategory.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">Veri yok</p>
            ) : data.byCategory.map((item) => (
              <div key={item.category} className="flex items-center justify-between">
                <span className="text-sm">{item.category}</span>
                <Badge variant="secondary">{item.count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Sehir Fiyat Karsilastirmasi */}
      {data.cityPriceStats && data.cityPriceStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Sehir Fiyat Karsilastirmasi (Satilik)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Şehir</th>
                    <th className="pb-2 font-medium text-right">Ortalama</th>
                    <th className="pb-2 font-medium text-right">En Dusuk</th>
                    <th className="pb-2 font-medium text-right">En Yuksek</th>
                    <th className="pb-2 font-medium text-right">İlan</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cityPriceStats.map((c) => (
                    <tr key={c.city} className="border-b last:border-0">
                      <td className="py-2 font-medium">{c.city}</td>
                      <td className="py-2 text-right text-[var(--primary)]">{formatPrice(c.avg)}</td>
                      <td className="py-2 text-right text-green-600">{formatPrice(c.min)}</td>
                      <td className="py-2 text-right text-red-500">{formatPrice(c.max)}</td>
                      <td className="py-2 text-right"><Badge variant="secondary">{c.count}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ilce Fiyat Sirasi */}
      {data.districtPrices && data.districtPrices.data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" /> {data.districtPrices.city} - Ilce Ortalama Fiyatlari (Satilik)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.districtPrices.data.map((d) => {
              const maxAvg = data.districtPrices!.data[0]?.avg || 1;
              return (
                <div key={d.district} className="flex items-center gap-3">
                  <span className="text-sm w-28 capitalize">{d.district}</span>
                  <div className="flex-1 h-4 bg-[var(--muted)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--primary)] rounded-full"
                      style={{ width: `${(d.avg / maxAvg) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-28 text-right">{formatPrice(d.avg)}</span>
                  <Badge variant="secondary" className="w-8 text-center">{d.count}</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Filtreleme Istatistikleri */}
      {data.filterStats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PieChart className="h-5 w-5" /> Emlakci Filtreleme</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-8">
              <div className="text-center">
                <p className="text-3xl font-bold">{data.filterStats.total}</p>
                <p className="text-xs text-[var(--muted-foreground)]">Toplam Taranan</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">{data.filterStats.total - data.filterStats.filtered}</p>
                <p className="text-xs text-[var(--muted-foreground)]">Kabul Edilen</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-red-500">{data.filterStats.filtered}</p>
                <p className="text-xs text-[var(--muted-foreground)]">Filtrelenen</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-orange-500">%{data.filterStats.rate}</p>
                <p className="text-xs text-[var(--muted-foreground)]">Filtreleme Orani</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Son 7 Gun Scraper */}
      {data.recentScrapes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Son 7 Gun Scraper Sonuclari</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.recentScrapes.map((s, i) => (
                <div key={i} className="flex items-center gap-4 text-sm">
                  <span className="text-xs text-[var(--muted-foreground)] w-32">
                    {new Date(s.startedAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <div className="flex-1 flex gap-3">
                    <span className="text-green-600">+{s.accepted} kabul</span>
                    <span className="text-red-500">-{s.rejected} red</span>
                    <span className="text-[var(--muted-foreground)]">{s.duplicates} tekrar</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
