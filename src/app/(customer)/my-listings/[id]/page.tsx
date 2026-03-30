"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPrice, formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  ExternalLink,
  MapPin,
  Home,
  Ruler,
  Building,
  Heart,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface Listing {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  currency: string;
  listingType: string;
  location: string | null;
  district: string | null;
  neighborhood: string | null;
  roomCount: string | null;
  squareMeters: number | null;
  buildingAge: string | null;
  floor: string | null;
  imageUrls: string[];
  sourceUrl: string;
  createdAt: string;
  city: { name: string };
  category: { name: string } | null;
}

export default function ListingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageIndex, setImageIndex] = useState(0);
  const [isFavorited, setIsFavorited] = useState(false);

  useEffect(() => {
    fetch(`/api/listings/${params.id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { setListing(data); setLoading(false); })
      .catch(() => setLoading(false));

    // Favori durumunu kontrol et
    fetch("/api/favorites").then((r) => r.ok ? r.json() : []).then((favs) => {
      setIsFavorited(favs.some((f: { listing: { id: string } }) => f.listing.id === params.id));
    });
  }, [params.id]);

  async function toggleFavorite() {
    if (!listing) return;
    if (isFavorited) {
      await fetch(`/api/favorites?listingId=${listing.id}`, { method: "DELETE" });
      setIsFavorited(false);
    } else {
      await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: listing.id }),
      });
      setIsFavorited(true);
    }
  }

  if (loading) return <div className="p-8 text-center text-[var(--muted-foreground)]">Yükleniyor...</div>;
  if (!listing) return <div className="p-8 text-center text-[var(--muted-foreground)]">İlan bulunamadı veya erişiminiz yok.</div>;

  const images = listing.imageUrls || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Geri
        </Button>
        <h1 className="text-xl font-bold flex-1 truncate">{listing.title}</h1>
        <Button variant="ghost" size="sm" onClick={toggleFavorite}>
          <Heart className={`h-5 w-5 ${isFavorited ? "fill-red-500 text-red-500" : ""}`} />
        </Button>
      </div>

      {/* Fotoğraf Galerisi */}
      {images.length > 0 && (
        <Card className="overflow-hidden">
          <div className="relative aspect-video bg-black">
            <img
              src={images[imageIndex]}
              alt={listing.title}
              className="w-full h-full object-contain"
            />
            {images.length > 1 && (
              <>
                <button
                  onClick={() => setImageIndex((i) => (i - 1 + images.length) % images.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setImageIndex((i) => (i + 1) % images.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                  {imageIndex + 1} / {images.length}
                </div>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-1 p-2 overflow-x-auto">
              {images.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setImageIndex(i)}
                  className={`shrink-0 w-16 h-12 rounded overflow-hidden border-2 ${
                    i === imageIndex ? "border-[var(--primary)]" : "border-transparent"
                  }`}
                >
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {/* Açıklama */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Açıklama</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {listing.description || "Açıklama mevcut değil."}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Bilgiler */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="text-2xl font-bold text-[var(--primary)]">
                {formatPrice(listing.price)}
              </div>
              <div className="flex gap-2 flex-wrap">
                <Badge variant={listing.listingType === "SALE" ? "default" : "secondary"}>
                  {listing.listingType === "SALE" ? "Satılık" : "Kiralık"}
                </Badge>
                {listing.category && <Badge variant="outline">{listing.category.name}</Badge>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detaylar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <DetailRow icon={MapPin} label="Konum" value={[listing.city.name, listing.district, listing.neighborhood].filter(Boolean).join(", ")} />
              {listing.roomCount && <DetailRow icon={Home} label="Oda" value={listing.roomCount} />}
              {listing.squareMeters && <DetailRow icon={Ruler} label="m²" value={`${listing.squareMeters} m²`} />}
              {listing.buildingAge && <DetailRow icon={Building} label="Bina Yaşı" value={listing.buildingAge} />}
              {listing.floor && <DetailRow icon={Building} label="Kat" value={listing.floor} />}
            </CardContent>
          </Card>

          <a
            href={listing.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-md border border-[var(--border)] px-4 py-3 text-sm font-medium hover:bg-[var(--accent)] transition-colors"
          >
            <ExternalLink className="h-4 w-4" /> Sahibinden'de Gör
          </a>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <Icon className="h-4 w-4 text-[var(--muted-foreground)] shrink-0" />
      <span className="text-[var(--muted-foreground)]">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
