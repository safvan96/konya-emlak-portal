"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";
import { ArrowLeft, MapPin, Home, Ruler, Building, ExternalLink } from "lucide-react";
import Link from "next/link";

interface Listing {
  id: string;
  title: string;
  price: number | null;
  listingType: string;
  location: string | null;
  district: string | null;
  roomCount: string | null;
  squareMeters: number | null;
  buildingAge: string | null;
  floor: string | null;
  imageUrls: string[];
  sourceUrl: string;
  city: { name: string };
  category: { name: string } | null;
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Yukleniyor...</div>}>
      <CompareContent />
    </Suspense>
  );
}

function CompareContent() {
  const searchParams = useSearchParams();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ids = searchParams.get("ids")?.split(",").filter(Boolean) || [];
    if (ids.length === 0) { setLoading(false); return; }

    Promise.all(
      ids.map((id) => fetch(`/api/listings/${id}`).then((r) => r.ok ? r.json() : null))
    ).then((results) => {
      setListings(results.filter(Boolean));
      setLoading(false);
    });
  }, [searchParams]);

  if (loading) return <div className="p-8 text-center text-[var(--muted-foreground)]">Yukleniyor...</div>;

  if (listings.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Ilan Karsilastirma</h1>
        <Card>
          <CardContent className="py-12 text-center text-[var(--muted-foreground)]">
            Karsilastirilacak ilan secilmedi. Ilanlarim sayfasindan ilan secerek karsilastirma yapabilirsiniz.
          </CardContent>
        </Card>
      </div>
    );
  }

  const fields = [
    { label: "Fiyat", key: "price", format: (l: Listing) => formatPrice(l.price) },
    { label: "Tip", key: "type", format: (l: Listing) => l.listingType === "SALE" ? "Satilik" : "Kiralik" },
    { label: "Konum", key: "location", format: (l: Listing) => `${l.city.name}${l.district ? `, ${l.district}` : ""}` },
    { label: "Kategori", key: "category", format: (l: Listing) => l.category?.name || "-" },
    { label: "Oda", key: "room", format: (l: Listing) => l.roomCount || "-" },
    { label: "m²", key: "sqm", format: (l: Listing) => l.squareMeters ? `${l.squareMeters} m²` : "-" },
    { label: "Bina Yasi", key: "age", format: (l: Listing) => l.buildingAge || "-" },
    { label: "Kat", key: "floor", format: (l: Listing) => l.floor || "-" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/my-listings">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" /> Geri</Button>
        </Link>
        <h1 className="text-2xl font-bold">Ilan Karsilastirma ({listings.length})</h1>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[600px]">
          {/* Resimler */}
          <thead>
            <tr>
              <th className="p-3 text-left text-sm font-medium text-[var(--muted-foreground)] w-28"></th>
              {listings.map((l) => (
                <th key={l.id} className="p-3 text-center">
                  {l.imageUrls[0] && (
                    <img src={l.imageUrls[0]} alt="" className="w-full h-32 object-cover rounded-md" />
                  )}
                  <Link href={`/my-listings/${l.id}`} className="text-sm font-medium hover:text-[var(--primary)] hover:underline mt-2 block line-clamp-2">
                    {l.title}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => (
              <tr key={field.key} className="border-t border-[var(--border)]">
                <td className="p-3 text-sm font-medium text-[var(--muted-foreground)]">{field.label}</td>
                {listings.map((l) => (
                  <td key={l.id} className="p-3 text-sm text-center font-medium">
                    {field.format(l)}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t border-[var(--border)]">
              <td className="p-3 text-sm font-medium text-[var(--muted-foreground)]">Link</td>
              {listings.map((l) => (
                <td key={l.id} className="p-3 text-center">
                  <a href={l.sourceUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-[var(--primary)] hover:underline">
                    <ExternalLink className="h-3 w-3" /> Sahibinden
                  </a>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
