"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";
import { Heart, MapPin, Ruler, Home, ExternalLink, Building2 } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { ImageWithFallback } from "@/components/ui/image-fallback";
import { CardSkeleton } from "@/components/ui/skeleton";

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
    sahibindenUrl: string | null;
    city: { name: string };
    category: { name: string } | null;
  };
}

export default function MyListingsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterDistrict, setFilterDistrict] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [searchText, setSearchText] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([fetchAssignments(), fetchFavorites()]).finally(() => setLoading(false));
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
    if (searchText && !a.listing.title.toLowerCase().includes(searchText.toLowerCase())) return false;
    if (filterCategory && a.listing.category?.name !== filterCategory) return false;
    if (filterType && a.listing.listingType !== filterType) return false;
    if (filterDistrict && a.listing.district !== filterDistrict) return false;
    if (priceMin && a.listing.price && a.listing.price < Number(priceMin)) return false;
    if (priceMax && a.listing.price && a.listing.price > Number(priceMax)) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case "price-asc": return (a.listing.price || 0) - (b.listing.price || 0);
      case "price-desc": return (b.listing.price || 0) - (a.listing.price || 0);
      case "newest": default: return 0;
    }
  });

  const categories = [...new Set(assignments.map((a) => a.listing.category?.name).filter(Boolean))];
  const districts = [...new Set(assignments.map((a) => a.listing.district).filter((d): d is string => !!d))];

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">İlanlarım</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">İlanlarım</h1>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Ara..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="w-48"
        />
        <Select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-44">
          <option value="">Tüm Kategoriler</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
        <Select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-32">
          <option value="">Tümü</option>
          <option value="SALE">Satılık</option>
          <option value="RENT">Kiralık</option>
        </Select>
        <Select value={filterDistrict} onChange={(e) => setFilterDistrict(e.target.value)} className="w-40">
          <option value="">Tüm İlçeler</option>
          {districts.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </Select>
        <Input
          type="number"
          placeholder="Min fiyat"
          value={priceMin}
          onChange={(e) => setPriceMin(e.target.value)}
          className="w-32"
        />
        <Input
          type="number"
          placeholder="Max fiyat"
          value={priceMax}
          onChange={(e) => setPriceMax(e.target.value)}
          className="w-32"
        />
        <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-40">
          <option value="newest">En Yeni</option>
          <option value="price-asc">Fiyat (Artan)</option>
          <option value="price-desc">Fiyat (Azalan)</option>
        </Select>
        <span className="self-center text-sm text-[var(--muted-foreground)]">
          {filtered.length} ilan
        </span>
        {compareIds.size >= 2 && (
          <Link
            href={`/compare?ids=${Array.from(compareIds).join(",")}`}
            className="self-center rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] px-3 py-1.5 text-xs font-medium hover:opacity-90"
          >
            Karsilastir ({compareIds.size})
          </Link>
        )}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-[var(--muted-foreground)]">
            Size atanmış ilan bulunmuyor.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((a) => (
            <Card key={a.id} className={`overflow-hidden ${compareIds.has(a.listing.id) ? "ring-2 ring-[var(--primary)]" : ""}`}>
              <div className="aspect-video bg-[var(--muted)] relative">
                {a.listing.imageUrls.length > 0 ? (
                  <>
                  <button
                    onClick={() => setCompareIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(a.listing.id)) next.delete(a.listing.id); else if (next.size < 4) next.add(a.listing.id);
                      return next;
                    })}
                    className={`absolute bottom-2 left-2 z-10 px-2 py-1 rounded text-[10px] font-bold transition-colors ${
                      compareIds.has(a.listing.id) ? "bg-[var(--primary)] text-white" : "bg-black/50 text-white hover:bg-black/70"
                    }`}
                  >
                    {compareIds.has(a.listing.id) ? "Secildi" : "Karsilastir"}
                  </button>
                  <ImageWithFallback
                    src={a.listing.imageUrls[0]}
                    alt={a.listing.title}
                    className="w-full h-full object-cover"
                    fallbackClassName="w-full h-full"
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
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Building2 className="h-10 w-10 text-[var(--muted-foreground)]" />
                  </div>
                )}
              </div>
              <CardContent className="p-4 space-y-2">
                <Link href={`/my-listings/${a.listing.id}`} className="font-semibold text-sm line-clamp-2 hover:text-[var(--primary)] hover:underline block">{a.listing.title}</Link>
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
                <div className="flex gap-3 mt-2">
                  <a href={a.listing.sourceUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                    <ExternalLink className="h-3 w-3" /> Emlakjet
                  </a>
                  {a.listing.sahibindenUrl && (
                    <a href={a.listing.sahibindenUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-orange-600 hover:underline">
                      <ExternalLink className="h-3 w-3" /> Sahibinden
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
