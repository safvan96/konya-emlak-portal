"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, TrendingUp, Home } from "lucide-react";
import Link from "next/link";
import { formatPrice } from "@/lib/utils";

const KonyaMap = dynamic(() => import("@/components/customer/konya-map"), {
  ssr: false,
  loading: () => <div className="h-[500px] w-full rounded-lg bg-[var(--muted)] animate-pulse" />,
});

interface DistrictData {
  district: string;
  count: number;
  avgPrice: number;
  avgSqm: number;
  pricePerSqm: number;
  listings: Array<{ id: string; title: string; price: number | null; listingType: string; squareMeters: number | null }>;
}

export default function CustomerMapPage() {
  const [data, setData] = useState<DistrictData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("SALE");
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/assignments")
      .then((r) => r.ok ? r.json() : [])
      .then((assignments: Array<{ listing: { id: string; title: string; price: number | null; listingType: string; district: string | null; squareMeters: number | null; city: { name: string } } }>) => {
        const groups: Record<string, { count: number; totalPrice: number; priceCount: number; totalSqm: number; sqmCount: number; listings: DistrictData["listings"] }> = {};
        for (const a of assignments) {
          const l = a.listing;
          if (filterType && l.listingType !== filterType) continue;
          const district = l.district || "Belirtilmemiş";
          if (!groups[district]) groups[district] = { count: 0, totalPrice: 0, priceCount: 0, totalSqm: 0, sqmCount: 0, listings: [] };
          groups[district].count++;
          if (l.price) { groups[district].totalPrice += l.price; groups[district].priceCount++; }
          if (l.squareMeters) { groups[district].totalSqm += l.squareMeters; groups[district].sqmCount++; }
          if (groups[district].listings.length < 5) {
            groups[district].listings.push({ id: l.id, title: l.title, price: l.price, listingType: l.listingType, squareMeters: l.squareMeters });
          }
        }

        const result = Object.entries(groups).map(([district, g]) => {
          const avgPrice = g.priceCount > 0 ? Math.round(g.totalPrice / g.priceCount) : 0;
          const avgSqm = g.sqmCount > 0 ? Math.round(g.totalSqm / g.sqmCount) : 0;
          const pricePerSqm = avgSqm > 0 ? Math.round(avgPrice / avgSqm) : 0;
          return { district, count: g.count, avgPrice, avgSqm, pricePerSqm, listings: g.listings };
        }).sort((a, b) => b.count - a.count);

        setData(result);
        setLoading(false);
      });
  }, [filterType]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent></Card>)}
        </div>
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const selected = selectedDistrict ? data.find((d) => d.district === selectedDistrict) : null;
  const totalListings = data.reduce((s, d) => s + d.count, 0);
  const overallAvg = data.reduce((s, d) => s + d.avgPrice * d.count, 0) / Math.max(totalListings, 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Konya İlçe Haritası</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          İlçelere göre ilanlarınızın ortalama fiyatları. İlçe kartına tıklayınca detay açılır.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <Select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-40">
          <option value="SALE">Satılık</option>
          <option value="RENT">Kiralık</option>
          <option value="">Tümü</option>
        </Select>
        <span className="text-sm text-[var(--muted-foreground)]">
          {data.length} ilçe • {totalListings} ilan
        </span>
        {totalListings > 0 && (
          <Badge variant="secondary" className="text-xs">
            Ortalama: {formatPrice(Math.round(overallAvg))}
          </Badge>
        )}
      </div>

      {data.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-[var(--muted-foreground)]">
            Bu kategoride size atanmış ilan yok.
          </CardContent>
        </Card>
      ) : (
        <>
          <KonyaMap data={data} />
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          {data.map((d) => {
            const intensity = Math.round((d.count / maxCount) * 100);
            const isActive = selectedDistrict === d.district;
            return (
              <Card
                key={d.district}
                className={`cursor-pointer transition-all hover:shadow-md ${isActive ? "ring-2 ring-[var(--primary)]" : ""}`}
                onClick={() => setSelectedDistrict(isActive ? null : d.district)}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin className="h-4 w-4 text-[var(--primary)] shrink-0" />
                      <span className="font-medium text-sm truncate">{d.district}</span>
                    </div>
                    <Badge variant="secondary" className="shrink-0">{d.count}</Badge>
                  </div>
                  <div className="w-full h-2 bg-[var(--muted)] rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--primary)] rounded-full transition-all" style={{ width: `${intensity}%` }} />
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--muted-foreground)]">Ortalama</span>
                      <span className="font-semibold">{formatPrice(d.avgPrice)}</span>
                    </div>
                    {d.pricePerSqm > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--muted-foreground)]">m² birim</span>
                        <span className="font-medium">{formatPrice(d.pricePerSqm)}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          </div>
        </>
      )}

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {selected.district}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-md border border-[var(--border)] p-3">
                <div className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
                  <Home className="h-3 w-3" /> İlan
                </div>
                <div className="text-lg font-bold">{selected.count}</div>
              </div>
              <div className="rounded-md border border-[var(--border)] p-3">
                <div className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
                  <TrendingUp className="h-3 w-3" /> Ort. Fiyat
                </div>
                <div className="text-lg font-bold">{formatPrice(selected.avgPrice)}</div>
              </div>
              {selected.avgSqm > 0 && (
                <div className="rounded-md border border-[var(--border)] p-3">
                  <div className="text-xs text-[var(--muted-foreground)]">Ort. m²</div>
                  <div className="text-lg font-bold">{selected.avgSqm}</div>
                </div>
              )}
              {selected.pricePerSqm > 0 && (
                <div className="rounded-md border border-[var(--border)] p-3">
                  <div className="text-xs text-[var(--muted-foreground)]">m² Birim</div>
                  <div className="text-lg font-bold">{formatPrice(selected.pricePerSqm)}</div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Son İlanlar</h3>
              {selected.listings.map((l) => (
                <Link
                  key={l.id}
                  href={`/my-listings/${l.id}`}
                  className="flex items-center justify-between rounded-md border border-[var(--border)] px-3 py-2 hover:bg-[var(--accent)] transition-colors"
                >
                  <span className="text-sm truncate max-w-[300px]">{l.title}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {l.squareMeters && (
                      <span className="text-xs text-[var(--muted-foreground)]">{l.squareMeters} m²</span>
                    )}
                    <Badge variant={l.listingType === "SALE" ? "default" : "secondary"} className="text-xs">
                      {l.listingType === "SALE" ? "Satılık" : "Kiralık"}
                    </Badge>
                    <span className="text-sm font-medium">{formatPrice(l.price)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 text-xs text-[var(--muted-foreground)] space-y-1">
          <p><strong>Not:</strong> Fiyatlar size atanan ilanlardan hesaplanır, piyasa ortalaması değildir.</p>
          <p>İmar durumu, tapu bilgisi gibi resmi veriler doğrulanmış kaynaklardan gelmediği için gösterilmez.</p>
        </CardContent>
      </Card>
    </div>
  );
}
