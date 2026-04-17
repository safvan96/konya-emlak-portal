"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPrice, formatDate } from "@/lib/utils";
import { ArrowLeft, Building2, Heart, ScrollText, Mail, Calendar, User } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

const ACTION_LABELS: Record<string, string> = {
  LOGIN: "Giriş", LOGOUT: "Çıkış", VIEW_LISTING: "İlan Görüntüleme",
  FAVORITE_ADD: "Favori Ekleme", FAVORITE_REMOVE: "Favori Cikarma",
  PASSWORD_CHANGED: "Sifre Degisikligi",
};

interface CustomerDetail {
  customer: {
    id: string; email: string; name: string; surname: string;
    isActive: boolean; createdAt: string;
    _count: { assignments: number; favorites: number; logs: number };
  };
  recentLogs: Array<{ id: string; action: string; details: string | null; createdAt: string; ipAddress: string | null }>;
  assignments: Array<{
    id: string; assignedAt: string;
    listing: { id: string; title: string; price: number | null; status: string; city: { name: string } };
  }>;
  favorites: Array<{
    id: string;
    listing: { id: string; title: string; price: number | null };
  }>;
  preferences: {
    cityIds: string[];
    categoryIds: string[];
    listingType: string | null;
    priceMin: number | null;
    priceMax: number | null;
    autoAssign: boolean;
  } | null;
}

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/customers/${params.id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => <Card key={i}><CardContent className="p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>)}
        </div>
      </div>
    );
  }

  if (!data) return <div className="p-8 text-center text-[var(--muted-foreground)]">Müşteri bulunamadı</div>;

  const { customer, recentLogs, assignments, favorites, preferences } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Geri
        </Button>
        <h1 className="text-2xl font-bold">{customer.name} {customer.surname}</h1>
        <Badge variant={customer.isActive ? "success" : "destructive"}>
          {customer.isActive ? "Aktif" : "Pasif"}
        </Badge>
      </div>

      {/* Ozet */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Mail className="h-5 w-5 text-[var(--muted-foreground)]" />
            <div>
              <p className="text-xs text-[var(--muted-foreground)]">Email</p>
              <p className="text-sm font-medium">{customer.email}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Building2 className="h-5 w-5 text-[var(--muted-foreground)]" />
            <div>
              <p className="text-xs text-[var(--muted-foreground)]">Atanmış İlan</p>
              <p className="text-lg font-bold">{customer._count.assignments}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Heart className="h-5 w-5 text-[var(--muted-foreground)]" />
            <div>
              <p className="text-xs text-[var(--muted-foreground)]">Favori</p>
              <p className="text-lg font-bold">{customer._count.favorites}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Calendar className="h-5 w-5 text-[var(--muted-foreground)]" />
            <div>
              <p className="text-xs text-[var(--muted-foreground)]">Kayit Tarihi</p>
              <p className="text-sm font-medium">{formatDate(customer.createdAt)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Atanmis Ilanlar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Atanmis Ilanlar ({assignments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-80 overflow-y-auto">
              <Table>
                <TableBody>
                  {assignments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <Link href={`/listings/${a.listing.id}`} className="text-sm font-medium hover:text-[var(--primary)] hover:underline line-clamp-1">
                          {a.listing.title}
                        </Link>
                        <p className="text-xs text-[var(--muted-foreground)]">{a.listing.city.name} - {formatPrice(a.listing.price)}</p>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={a.listing.status === "ACTIVE" ? "success" : "secondary"} className="text-xs">
                          {a.listing.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {assignments.length === 0 && (
                    <TableRow><TableCell className="text-center py-4 text-[var(--muted-foreground)]">Atanmis ilan yok</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Son Aktiviteler */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScrollText className="h-5 w-5" />
              Son Aktiviteler ({recentLogs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-80 overflow-y-auto space-y-2">
              {recentLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between border-b border-[var(--border)] pb-2 last:border-0">
                  <div>
                    <Badge variant="outline" className="text-xs">{ACTION_LABELS[log.action] || log.action}</Badge>
                    {log.details && <p className="text-xs text-[var(--muted-foreground)] mt-1 truncate max-w-[250px]">{log.details}</p>}
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-xs text-[var(--muted-foreground)]">{formatDate(log.createdAt)}</p>
                    {log.ipAddress && <p className="text-[10px] text-[var(--muted-foreground)]">{log.ipAddress}</p>}
                  </div>
                </div>
              ))}
              {recentLogs.length === 0 && (
                <p className="text-center py-4 text-[var(--muted-foreground)]">Aktivite yok</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Favoriler */}
      {favorites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5" />
              Favoriler ({favorites.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {favorites.map((f) => (
                <Link
                  key={f.id}
                  href={`/listings/${f.listing.id}`}
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--accent)] transition-colors"
                >
                  <span className="font-medium">{f.listing.title.slice(0, 40)}...</span>
                  <span className="text-[var(--muted-foreground)] ml-2">{formatPrice(f.listing.price)}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tercihler */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Tercihler
            {preferences?.autoAssign && <Badge variant="success" className="text-xs">Oto-Atama Aktif</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {preferences ? (
            <div className="grid gap-3 md:grid-cols-2 text-sm">
              <div>
                <span className="text-[var(--muted-foreground)]">Sehirler:</span>
                <span className="ml-2 font-medium">{preferences.cityIds?.length > 0 ? preferences.cityIds.join(", ") : "Hepsi"}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)]">Kategoriler:</span>
                <span className="ml-2 font-medium">{preferences.categoryIds?.length > 0 ? preferences.categoryIds.join(", ") : "Hepsi"}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)]">Tip:</span>
                <span className="ml-2 font-medium">{preferences.listingType === "SALE" ? "Satılık" : preferences.listingType === "RENT" ? "Kiralık" : "Hepsi"}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)]">Fiyat:</span>
                <span className="ml-2 font-medium">
                  {preferences.priceMin || preferences.priceMax
                    ? `${preferences.priceMin ? formatPrice(preferences.priceMin) : "0"} - ${preferences.priceMax ? formatPrice(preferences.priceMax) : "∞"}`
                    : "Sinir yok"}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted-foreground)]">Tercih belirlenmemis</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
