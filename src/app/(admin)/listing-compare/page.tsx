"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/utils";
import { ArrowLeft, Search, Plus, X } from "lucide-react";
import Link from "next/link";

interface Listing {
  id: string;
  title: string;
  price: number | null;
  listingType: string;
  district: string | null;
  roomCount: string | null;
  squareMeters: number | null;
  buildingAge: string | null;
  floor: string | null;
  imageUrls: string[];
  isFromOwner: boolean;
  status: string;
  city: { name: string };
  category: { name: string } | null;
}

export default function AdminComparePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Yukleniyor...</div>}>
      <CompareContent />
    </Suspense>
  );
}

function CompareContent() {
  const searchParams = useSearchParams();
  const [listings, setListings] = useState<Listing[]>([]);
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<Listing[]>([]);

  useEffect(() => {
    const ids = searchParams.get("ids")?.split(",").filter(Boolean) || [];
    if (ids.length > 0) {
      Promise.all(ids.map((id) => fetch(`/api/listings/${id}`).then((r) => r.ok ? r.json() : null)))
        .then((results) => setListings(results.filter(Boolean)));
    }
  }, [searchParams]);

  async function searchListings() {
    if (!searchText.trim()) return;
    const res = await fetch(`/api/listings?search=${searchText}&limit=10`);
    if (res.ok) {
      const data = await res.json();
      setSearchResults(data.listings.filter((l: Listing) => !listings.some((e) => e.id === l.id)));
    }
  }

  function addListing(listing: Listing) {
    if (listings.length >= 4) return;
    setListings((prev) => [...prev, listing]);
    setSearchResults((prev) => prev.filter((l) => l.id !== listing.id));
  }

  function removeListing(id: string) {
    setListings((prev) => prev.filter((l) => l.id !== id));
  }

  const fields = [
    { label: "Fiyat", format: (l: Listing) => formatPrice(l.price) },
    { label: "Tip", format: (l: Listing) => l.listingType === "SALE" ? "Satilik" : "Kiralik" },
    { label: "Konum", format: (l: Listing) => `${l.city.name}${l.district ? `, ${l.district}` : ""}` },
    { label: "Kategori", format: (l: Listing) => l.category?.name || "-" },
    { label: "Oda", format: (l: Listing) => l.roomCount || "-" },
    { label: "m2", format: (l: Listing) => l.squareMeters ? `${l.squareMeters} m2` : "-" },
    { label: "Bina Yasi", format: (l: Listing) => l.buildingAge || "-" },
    { label: "Kat", format: (l: Listing) => l.floor || "-" },
    { label: "Kaynak", format: (l: Listing) => l.isFromOwner ? "Sahibinden" : "Emlakci" },
    { label: "Durum", format: (l: Listing) => l.status },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/listings"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" /> Ilanlar</Button></Link>
        <h1 className="text-2xl font-bold">Ilan Karsilastirma</h1>
      </div>

      {/* Ilan Ekle */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            <Input placeholder="Ilan ara..." value={searchText} onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchListings()} />
            <Button onClick={searchListings}><Search className="h-4 w-4" /></Button>
          </div>
          {searchResults.length > 0 && (
            <div className="mt-2 max-h-40 overflow-y-auto border rounded-md">
              {searchResults.map((l) => (
                <button key={l.id} onClick={() => addListing(l)}
                  className="w-full flex items-center justify-between p-2 border-b last:border-0 hover:bg-[var(--accent)] text-left text-sm">
                  <span className="truncate">{l.title}</span>
                  <Plus className="h-4 w-4 shrink-0 ml-2" />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {listings.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-[var(--muted-foreground)]">
          Karsilastirilacak ilan ekleyin (arama ile max 4)
        </CardContent></Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[500px]">
            <thead>
              <tr>
                <th className="p-3 text-left text-sm w-28"></th>
                {listings.map((l) => (
                  <th key={l.id} className="p-3 text-center relative">
                    <button onClick={() => removeListing(l.id)} className="absolute top-1 right-1 p-1 hover:bg-red-50 rounded text-red-400">
                      <X className="h-3 w-3" />
                    </button>
                    <Link href={`/listings/${l.id}`} className="text-sm font-medium hover:text-[var(--primary)] hover:underline line-clamp-2">
                      {l.title}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fields.map((f, i) => (
                <tr key={i} className="border-t border-[var(--border)]">
                  <td className="p-3 text-sm font-medium text-[var(--muted-foreground)]">{f.label}</td>
                  {listings.map((l) => (
                    <td key={l.id} className="p-3 text-sm text-center font-medium">{f.format(l)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
