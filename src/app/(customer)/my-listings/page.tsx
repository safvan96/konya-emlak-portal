"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";
import { Heart, MapPin, Ruler, Home, ExternalLink } from "lucide-react";

interface Assignment {
  id: string;
  listing: {
    id: string;
    title: string;
    description: string;
    price: number | null;
    currency: string;
    listingType: string;
    location: string | null;
    district: string | null;
    roomCount: string | null;
    squareMeters: number | null;
    imageUrls: string[];
    sourceUrl: string;
    city: { name: string };
    category: { name: string } | null;
  };
}

export default function MyListingsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterType, setFilterType] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchAssignments();
    fetchFavorites();
  }, []);

  async function fetchAssignments() {
    const res = await fetch("/api/assignments");
    if (res.ok) setAssignments(await res.json());
  }

  async function fetchFavorites() {
    const res = await fetch("/api/favorites");
    if (res.ok) {
      const favs = await res.json();
      setFavorites(new Set(favs.map((f: { listing: { id: string } }) => f.listing.id)));
    }
  }

  async function toggleFavorite(listingId: string) {
    if (favorites.has(listingId)) {
      await fetch(`/api/favorites?listingId=${listingId}`, { method: "DELETE" });
      setFavorites((prev) => { const n = new Set(prev); n.delete(listingId); return n; });
    } else {
      await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      });
      setFavorites((prev) => new Set(prev).add(listingId));
    }
  }

  const filtered = assignments.filter((a) => {
    if (filterCategory && a.listing.category?.name !== filterCategory) return false;
    if (filterType && a.listing.listingType !== filterType) return false;
    return true;
  });

  const categories = [...new Set(assignments.map((a) => a.listing.category?.name).filter(Boolean))];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">İlanlarım</h1>

      <div className="flex gap-4">
        <Select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-48">
          <option value="">Tüm Kategoriler</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
        <Select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-40">
          <option value="">Tümü</option>
          <option value="SALE">Satılık</option>
          <option value="RENT">Kiralık</option>
        </Select>
        <span className="self-center text-sm text-[var(--muted-foreground)]">
          {filtered.length} ilan
        </span>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-[var(--muted-foreground)]">
            Size atanmış ilan bulunmuyor.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => (
            <Card key={a.id} className="overflow-hidden">
              {a.listing.imageUrls.length > 0 && (
                <div className="aspect-video bg-[var(--muted)] relative">
                  <img
                    src={a.listing.imageUrls[0]}
                    alt={a.listing.title}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => toggleFavorite(a.listing.id)}
                    className="absolute top-2 right-2 p-2 bg-white/80 rounded-full hover:bg-white transition"
                  >
                    <Heart
                      className={`h-4 w-4 ${favorites.has(a.listing.id) ? "fill-red-500 text-red-500" : "text-gray-600"}`}
                    />
                  </button>
                  <Badge className="absolute top-2 left-2" variant={a.listing.listingType === "SALE" ? "default" : "secondary"}>
                    {a.listing.listingType === "SALE" ? "Satılık" : "Kiralık"}
                  </Badge>
                </div>
              )}
              <CardContent className="p-4 space-y-2">
                <h3 className="font-semibold text-sm line-clamp-2">{a.listing.title}</h3>
                <p className="text-lg font-bold text-[var(--primary)]">
                  {formatPrice(a.listing.price)}
                </p>
                <div className="flex flex-wrap gap-2 text-xs text-[var(--muted-foreground)]">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {a.listing.city.name}{a.listing.district ? `, ${a.listing.district}` : ""}
                  </span>
                  {a.listing.roomCount && (
                    <span className="flex items-center gap-1">
                      <Home className="h-3 w-3" />
                      {a.listing.roomCount}
                    </span>
                  )}
                  {a.listing.squareMeters && (
                    <span className="flex items-center gap-1">
                      <Ruler className="h-3 w-3" />
                      {a.listing.squareMeters} m²
                    </span>
                  )}
                </div>
                {a.listing.category && (
                  <Badge variant="outline" className="text-xs">{a.listing.category.name}</Badge>
                )}
                <a
                  href={a.listing.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-[var(--primary)] hover:underline mt-2"
                >
                  <ExternalLink className="h-3 w-3" />
                  Sahibinden&apos;de Gör
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
