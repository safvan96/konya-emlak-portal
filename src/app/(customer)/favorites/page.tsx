"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";
import { Heart, MapPin, Ruler, Home, ExternalLink } from "lucide-react";
import Link from "next/link";
import { ImageWithFallback } from "@/components/ui/image-fallback";
import { CardSkeleton } from "@/components/ui/skeleton";

interface FavoriteItem {
  id: string;
  listing: {
    id: string;
    title: string;
    price: number | null;
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

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");

  useEffect(() => {
    fetchFavorites().finally(() => setLoading(false));
  }, []);

  async function fetchFavorites() {
    const res = await fetch("/api/favorites");
    if (res.ok) setFavorites(await res.json());
  }

  async function removeFavorite(listingId: string) {
    await fetch(`/api/favorites?listingId=${listingId}`, { method: "DELETE" });
    setFavorites((prev) => prev.filter((f) => f.listing.id !== listingId));
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Favorilerim</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  const saleCount = favorites.filter((f) => f.listing.listingType === "SALE").length;
  const rentCount = favorites.filter((f) => f.listing.listingType === "RENT").length;
  const filtered = filterType ? favorites.filter((f) => f.listing.listingType === filterType) : favorites;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Favorilerim</h1>
        {favorites.length > 0 && (
          <div className="flex gap-2 text-sm">
            <button
              onClick={() => setFilterType("")}
              className={`px-3 py-1 rounded-full transition-colors ${filterType === "" ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "bg-[var(--muted)] hover:bg-[var(--accent)]"}`}
            >
              Tümü ({favorites.length})
            </button>
            <button
              onClick={() => setFilterType("SALE")}
              className={`px-3 py-1 rounded-full transition-colors ${filterType === "SALE" ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "bg-[var(--muted)] hover:bg-[var(--accent)]"}`}
            >
              Satılık ({saleCount})
            </button>
            <button
              onClick={() => setFilterType("RENT")}
              className={`px-3 py-1 rounded-full transition-colors ${filterType === "RENT" ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "bg-[var(--muted)] hover:bg-[var(--accent)]"}`}
            >
              Kiralık ({rentCount})
            </button>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-[var(--muted-foreground)]">
            {favorites.length === 0 ? "Henüz favori ilanınız yok." : "Bu tipte favori yok."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((fav) => (
            <Card key={fav.id} className="overflow-hidden">
              {fav.listing.imageUrls.length > 0 && (
                <div className="aspect-video bg-[var(--muted)] relative">
                  <ImageWithFallback src={fav.listing.imageUrls[0]} alt={fav.listing.title} className="w-full h-full object-cover" fallbackClassName="w-full h-full" />
                  <button
                    onClick={() => removeFavorite(fav.listing.id)}
                    className="absolute top-2 right-2 p-2 bg-white/80 rounded-full hover:bg-white transition"
                  >
                    <Heart className="h-4 w-4 fill-red-500 text-red-500" />
                  </button>
                  <Badge className="absolute top-2 left-2" variant={fav.listing.listingType === "SALE" ? "default" : "secondary"}>
                    {fav.listing.listingType === "SALE" ? "Satılık" : "Kiralık"}
                  </Badge>
                </div>
              )}
              <CardContent className="p-4 space-y-2">
                <Link href={`/my-listings/${fav.listing.id}`} className="font-semibold text-sm line-clamp-2 hover:text-[var(--primary)] hover:underline block">{fav.listing.title}</Link>
                <p className="text-lg font-bold text-[var(--primary)]">{formatPrice(fav.listing.price)}</p>
                <div className="flex flex-wrap gap-2 text-xs text-[var(--muted-foreground)]">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {fav.listing.city.name}{fav.listing.district ? `, ${fav.listing.district}` : ""}
                  </span>
                  {fav.listing.roomCount && (
                    <span className="flex items-center gap-1"><Home className="h-3 w-3" />{fav.listing.roomCount}</span>
                  )}
                  {fav.listing.squareMeters && (
                    <span className="flex items-center gap-1"><Ruler className="h-3 w-3" />{fav.listing.squareMeters} m²</span>
                  )}
                </div>
                <div className="flex gap-3 mt-2">
                  <a href={fav.listing.sourceUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline">
                    <ExternalLink className="h-3 w-3" /> İlana Git
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
