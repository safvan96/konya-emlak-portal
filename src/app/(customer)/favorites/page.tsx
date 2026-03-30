"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";
import { Heart, MapPin, Ruler, Home, ExternalLink } from "lucide-react";

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
    city: { name: string };
    category: { name: string } | null;
  };
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);

  useEffect(() => {
    fetchFavorites();
  }, []);

  async function fetchFavorites() {
    const res = await fetch("/api/favorites");
    if (res.ok) setFavorites(await res.json());
  }

  async function removeFavorite(listingId: string) {
    await fetch(`/api/favorites?listingId=${listingId}`, { method: "DELETE" });
    setFavorites((prev) => prev.filter((f) => f.listing.id !== listingId));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Favorilerim</h1>

      {favorites.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-[var(--muted-foreground)]">
            Henüz favori ilanınız yok.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {favorites.map((fav) => (
            <Card key={fav.id} className="overflow-hidden">
              {fav.listing.imageUrls.length > 0 && (
                <div className="aspect-video bg-[var(--muted)] relative">
                  <img src={fav.listing.imageUrls[0]} alt={fav.listing.title} className="w-full h-full object-cover" />
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
                <h3 className="font-semibold text-sm line-clamp-2">{fav.listing.title}</h3>
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
                <a href={fav.listing.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-[var(--primary)] hover:underline mt-2">
                  <ExternalLink className="h-3 w-3" /> Sahibinden&apos;de Gör
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
