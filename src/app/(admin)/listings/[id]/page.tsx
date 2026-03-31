"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { formatPrice, formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  ExternalLink,
  MapPin,
  Home,
  Ruler,
  UserPlus,
  Printer,
  Monitor,
  Building,
  Calendar,
  Users,
  Heart,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface Listing {
  id: string;
  sahibindenId: string;
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
  sahibindenUrl: string | null;
  sellerName: string | null;
  sellerPhone: string | null;
  isFromOwner: boolean;
  rejectionReason: string | null;
  status: string;
  createdAt: string;
  scrapedAt: string | null;
  city: { name: string };
  category: { name: string } | null;
  assignments: Array<{
    id: string;
    assignedAt: string;
    user: { id: string; name: string; surname: string; email: string };
  }>;
  _count: { assignments: number; favorites: number };
}

export default function ListingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageIndex, setImageIndex] = useState(0);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string; surname: string }>>([]);
  const [showAssign, setShowAssign] = useState(false);
  const [assignCustomer, setAssignCustomer] = useState("");
  const [priceHistory, setPriceHistory] = useState<Array<{ oldPrice: number; newPrice: number; changedAt: string }>>([]);

  useEffect(() => {
    fetch(`/api/listings/${params.id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { setListing(data); setLoading(false); })
      .catch(() => setLoading(false));

    fetch(`/api/listings/${params.id}/history`)
      .then((r) => r.ok ? r.json() : [])
      .then(setPriceHistory);
  }, [params.id]);

  async function quickAssign() {
    if (!assignCustomer || !listing) return;
    await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: assignCustomer, listingIds: [listing.id] }),
    });
    setShowAssign(false);
    setAssignCustomer("");
    // Detayı yeniden yükle
    const res = await fetch(`/api/listings/${params.id}`);
    if (res.ok) setListing(await res.json());
  }

  function openAssignForm() {
    if (customers.length === 0) {
      fetch("/api/customers").then((r) => r.json()).then(setCustomers);
    }
    setShowAssign(!showAssign);
  }

  async function updateStatus(status: string) {
    if (!listing) return;
    await fetch("/api/listings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: listing.id, status }),
    });
    setListing({ ...listing, status });
  }

  if (loading) return <div className="p-8 text-center text-[var(--muted-foreground)]">Yükleniyor...</div>;
  if (!listing) return <div className="p-8 text-center text-[var(--muted-foreground)]">İlan bulunamadı</div>;

  const images = listing.imageUrls || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Geri
        </Button>
        <h1 className="text-2xl font-bold flex-1 truncate">{listing.title}</h1>
        <div className="flex items-center gap-2 no-print">
          <Button variant="ghost" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
          </Button>
          <Link
            href={`/listings/${listing.id}/preview`}
            className="flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--primary)]"
          >
            <Monitor className="h-4 w-4" /> Onizleme
          </Link>
          <a
            href={listing.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm font-medium text-[var(--primary)] hover:underline"
          >
            <ExternalLink className="h-4 w-4" /> İlana Git
          </a>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sol: Fotoğraflar + Açıklama */}
        <div className="lg:col-span-2 space-y-4">
          {/* Fotoğraf Galerisi */}
          {images.length > 0 && (
            <Card className="overflow-hidden">
              <div className="relative aspect-video bg-[var(--muted)]">
                <img
                  src={images[imageIndex]}
                  alt={listing.title}
                  className="w-full h-full object-contain bg-black"
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

          {/* Açıklama */}
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

          {/* Atamalar */}
          {listing.assignments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Atanan Müşteriler ({listing.assignments.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {listing.assignments.map((a) => (
                    <div key={a.id} className="flex items-center justify-between rounded-md border border-[var(--border)] px-3 py-2">
                      <div>
                        <span className="font-medium text-sm">{a.user.name} {a.user.surname}</span>
                        <span className="text-xs text-[var(--muted-foreground)] ml-2">{a.user.email}</span>
                      </div>
                      <span className="text-xs text-[var(--muted-foreground)]">{formatDate(a.assignedAt)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sağ: Bilgiler */}
        <div className="space-y-4">
          {/* Fiyat + Durum */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="text-2xl font-bold text-[var(--primary)]">
                {formatPrice(listing.price)}
              </div>
              <div className="flex gap-2 flex-wrap">
                <Badge variant={listing.listingType === "SALE" ? "default" : "secondary"}>
                  {listing.listingType === "SALE" ? "Satılık" : "Kiralık"}
                </Badge>
                {listing.isFromOwner ? (
                  <Badge variant="success">Sahibinden</Badge>
                ) : (
                  <Badge variant="destructive">Emlakçı</Badge>
                )}
                {listing.category && <Badge variant="outline">{listing.category.name}</Badge>}
              </div>
              {/* İlan Sahibi Bilgileri */}
              {(listing.sellerName || listing.sellerPhone) && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-medium text-green-800">İlan Sahibi</p>
                  {listing.sellerName && (
                    <p className="text-sm font-semibold">{listing.sellerName}</p>
                  )}
                  {listing.sellerPhone && (
                    <a href={`tel:${listing.sellerPhone}`} className="text-sm text-green-700 font-mono hover:underline">
                      {listing.sellerPhone}
                    </a>
                  )}
                </div>
              )}
              {listing.rejectionReason && (
                <p className="text-xs text-red-600 bg-red-50 rounded p-2">
                  Red sebebi: {listing.rejectionReason}
                </p>
              )}
              <div>
                <label className="text-xs text-[var(--muted-foreground)]">Durum</label>
                <Select
                  value={listing.status}
                  onChange={(e) => updateStatus(e.target.value)}
                  className="mt-1"
                >
                  <option value="ACTIVE">Aktif</option>
                  <option value="PASSIVE">Pasif</option>
                  <option value="SOLD">Satıldı</option>
                  <option value="RENTED">Kiralandı</option>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Detaylar */}
          <Card>
            <CardHeader>
              <CardTitle>Detaylar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <DetailRow icon={MapPin} label="Konum" value={[listing.city.name, listing.district, listing.neighborhood].filter(Boolean).join(", ")} />
              {listing.location && <DetailRow icon={MapPin} label="Adres" value={listing.location} />}
              {listing.roomCount && <DetailRow icon={Home} label="Oda Sayısı" value={listing.roomCount} />}
              {listing.squareMeters && <DetailRow icon={Ruler} label="m²" value={`${listing.squareMeters} m²`} />}
              {listing.buildingAge && <DetailRow icon={Building} label="Bina Yaşı" value={listing.buildingAge} />}
              {listing.floor && <DetailRow icon={Building} label="Kat" value={listing.floor} />}
            </CardContent>
          </Card>

          {/* İstatistikler */}
          <Card>
            <CardHeader>
              <CardTitle>İstatistikler</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <DetailRow icon={Users} label="Atama" value={`${listing._count.assignments} müşteri`} />
              <DetailRow icon={Heart} label="Favori" value={`${listing._count.favorites} kez`} />
              <DetailRow icon={Calendar} label="Eklenme" value={formatDate(listing.createdAt)} />
              {listing.scrapedAt && <DetailRow icon={Calendar} label="Çekilme" value={formatDate(listing.scrapedAt)} />}
              <div className="text-xs text-[var(--muted-foreground)] pt-2 border-t border-[var(--border)]">
                Sahibinden ID: {listing.sahibindenId}
              </div>
            </CardContent>
          </Card>

          {/* Fiyat Gecmisi */}
          {priceHistory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Fiyat Gecmisi</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {priceHistory.map((h, i) => (
                  <div key={i} className="flex items-center justify-between text-sm border-b border-[var(--border)] pb-1 last:border-0">
                    <div>
                      <span className="text-red-500 line-through">{formatPrice(h.oldPrice)}</span>
                      <span className="mx-2">→</span>
                      <span className="text-green-600 font-medium">{formatPrice(h.newPrice)}</span>
                    </div>
                    <span className="text-xs text-[var(--muted-foreground)]">{formatDate(h.changedAt)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Hızlı Atama */}
          <Card>
            <CardContent className="p-4">
              <Button size="sm" variant="outline" className="w-full" onClick={openAssignForm}>
                <UserPlus className="h-4 w-4 mr-2" />
                Müşteriye Ata
              </Button>
              {showAssign && (
                <div className="mt-3 space-y-2">
                  <Select value={assignCustomer} onChange={(e) => setAssignCustomer(e.target.value)}>
                    <option value="">Müşteri seçin...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} {c.surname}</option>
                    ))}
                  </Select>
                  <Button size="sm" className="w-full" onClick={quickAssign} disabled={!assignCustomer}>
                    Ata
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
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
