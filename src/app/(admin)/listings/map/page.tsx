"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin } from "lucide-react";
import Link from "next/link";
import { formatPrice } from "@/lib/utils";

interface DistrictData {
  district: string;
  count: number;
  avgPrice: number;
  listings: Array<{ id: string; title: string; price: number | null; listingType: string }>;
}

export default function ListingsMapPage() {
  const [data, setData] = useState<DistrictData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ isFromOwner: "true", status: "ACTIVE", limit: "500" });
    if (filterType) params.set("listingType", filterType);

    fetch(`/api/listings?${params}`)
      .then((r) => r.ok ? r.json() : { listings: [] })
      .then((res) => {
        // Ilce bazli gruplama
        const groups: Record<string, { count: number; totalPrice: number; listings: DistrictData["listings"] }> = {};
        for (const l of res.listings) {
          const district = l.district || l.city?.name || "Diger";
          if (!groups[district]) groups[district] = { count: 0, totalPrice: 0, listings: [] };
          groups[district].count++;
          if (l.price) groups[district].totalPrice += l.price;
          if (groups[district].listings.length < 5) {
            groups[district].listings.push({ id: l.id, title: l.title, price: l.price, listingType: l.listingType });
          }
        }

        const result = Object.entries(groups).map(([district, g]) => ({
          district,
          count: g.count,
          avgPrice: g.count > 0 ? Math.round(g.totalPrice / g.count) : 0,
          listings: g.listings,
        })).sort((a, b) => b.count - a.count);

        setData(result);
        setLoading(false);
      });
  }, [filterType]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>)}
        </div>
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const selected = selectedDistrict ? data.find((d) => d.district === selectedDistrict) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Ilce Haritasi</h1>
        <Select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-40">
          <option value="">Tumunu</option>
          <option value="SALE">Satilik</option>
          <option value="RENT">Kiralik</option>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        {data.map((d) => {
          const intensity = Math.round((d.count / maxCount) * 100);
          return (
            <Card
              key={d.district}
              className={`cursor-pointer transition-all hover:shadow-md ${selectedDistrict === d.district ? "ring-2 ring-[var(--primary)]" : ""}`}
              onClick={() => setSelectedDistrict(selectedDistrict === d.district ? null : d.district)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-[var(--primary)]" />
                    <span className="font-medium text-sm">{d.district}</span>
                  </div>
                  <Badge variant="secondary">{d.count}</Badge>
                </div>
                {/* Yogunluk bar */}
                <div className="w-full h-2 bg-[var(--muted)] rounded-full overflow-hidden mb-2">
                  <div className="h-full bg-[var(--primary)] rounded-full transition-all" style={{ width: `${intensity}%` }} />
                </div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Ort: {formatPrice(d.avgPrice)}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Secili ilce detayi */}
      {selected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {selected.district} - Son Ilanlar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {selected.listings.map((l) => (
                <Link
                  key={l.id}
                  href={`/listings/${l.id}`}
                  className="flex items-center justify-between rounded-md border border-[var(--border)] px-3 py-2 hover:bg-[var(--accent)] transition-colors"
                >
                  <span className="text-sm truncate max-w-[300px]">{l.title}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={l.listingType === "SALE" ? "default" : "secondary"} className="text-xs">
                      {l.listingType === "SALE" ? "Satilik" : "Kiralik"}
                    </Badge>
                    <span className="text-sm font-medium">{formatPrice(l.price)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {data.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-[var(--muted-foreground)]">
            Ilan bulunamadi
          </CardContent>
        </Card>
      )}
    </div>
  );
}
