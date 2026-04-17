"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";
import { Check, X, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/ui/toast";

interface Listing {
  id: string;
  title: string;
  description: string;
  price: number | null;
  listingType: string;
  district: string | null;
  isFromOwner: boolean;
  rejectionReason: string | null;
  sourceUrl: string;
  city: { name: string };
  category: { name: string } | null;
}

// Reddedilmiş ilanları gözden geçirme - yanlışlıkla reddedilmiş olabilir
export default function ReviewPage() {
  const { toast } = useToast();
  const [listings, setListings] = useState<Listing[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/listings?isFromOwner=false&status=PASSIVE&limit=50")
      .then((r) => r.ok ? r.json() : { listings: [] })
      .then((data) => { setListings(data.listings); setLoading(false); });
  }, []);

  async function approve(id: string) {
    await fetch("/api/listings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "ACTIVE" }),
    });
    // isFromOwner'i da true yap
    await fetch("/api/listings/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "changeStatus", ids: [id], status: "ACTIVE" }),
    });
    toast("İlan onaylandı", "success");
    next();
  }

  function reject() {
    toast("İlan reddedildi", "info");
    next();
  }

  function next() {
    if (index < listings.length - 1) setIndex(index + 1);
    else { setListings((prev) => prev.filter((_, i) => i > index)); setIndex(0); }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const l = listings[index];
      if (!l) return;
      if (e.key === "ArrowRight") { e.preventDefault(); if (index < listings.length - 1) setIndex(index + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); if (index > 0) setIndex(index - 1); }
      else if (e.key === "a" || e.key === "A") { e.preventDefault(); approve(l.id); }
      else if (e.key === "r" || e.key === "R") { e.preventDefault(); reject(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, listings]);

  if (loading) return <div className="p-8 text-center text-[var(--muted-foreground)]">Yükleniyor...</div>;

  if (listings.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">İlan İnceleme</h1>
        <Card>
          <CardContent className="py-12 text-center text-[var(--muted-foreground)]">
            İncelenecek ilan yok. Tüm reddedilen ilanlar gözden geçirildi.
          </CardContent>
        </Card>
      </div>
    );
  }

  const listing = listings[index];
  if (!listing) return null;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-3xl font-bold">İlan İnceleme</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--muted-foreground)] hidden sm:inline">
            Kısayollar: <kbd className="px-1 rounded bg-[var(--muted)] font-mono">A</kbd> onayla · <kbd className="px-1 rounded bg-[var(--muted)] font-mono">R</kbd> reddet · <kbd className="px-1 rounded bg-[var(--muted)] font-mono">←→</kbd> gezin
          </span>
          <Badge variant="secondary">{index + 1} / {listings.length}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{listing.title}</CardTitle>
            <a href={listing.sourceUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-[var(--primary)] hover:underline">
              <ExternalLink className="h-4 w-4" /> Sahibinden
            </a>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Badge variant={listing.listingType === "SALE" ? "default" : "secondary"}>
              {listing.listingType === "SALE" ? "Satılık" : "Kiralık"}
            </Badge>
            <Badge variant="outline">{listing.city.name}{listing.district ? ` / ${listing.district}` : ""}</Badge>
            {listing.category && <Badge variant="outline">{listing.category.name}</Badge>}
            <span className="font-bold text-[var(--primary)]">{formatPrice(listing.price)}</span>
          </div>

          {listing.rejectionReason && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-700 font-medium">Red sebebi:</p>
              <p className="text-sm text-red-600">{listing.rejectionReason}</p>
            </div>
          )}

          <div className="rounded-md bg-[var(--muted)] p-4 max-h-64 overflow-y-auto">
            <p className="text-sm whitespace-pre-wrap">{listing.description}</p>
          </div>

          {/* Aksiyonlar */}
          <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
            <Button variant="outline" size="sm" disabled={index === 0} onClick={() => setIndex(index - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Önceki
            </Button>
            <div className="flex gap-3">
              <Button variant="destructive" size="lg" onClick={reject}>
                <X className="h-5 w-5 mr-2" /> Reddet
              </Button>
              <Button size="lg" onClick={() => approve(listing.id)} className="bg-green-600 hover:bg-green-700 text-white">
                <Check className="h-5 w-5 mr-2" /> Onayla
              </Button>
            </div>
            <Button variant="outline" size="sm" disabled={index >= listings.length - 1} onClick={() => setIndex(index + 1)}>
              Sonraki <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
