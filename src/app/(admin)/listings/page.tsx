"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPrice, formatDate } from "@/lib/utils";
import { ExternalLink, Trash2, ChevronLeft, ChevronRight, Eye, Download, UserPlus } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/ui/toast";

interface Listing {
  id: string;
  sahibindenId: string;
  title: string;
  price: number | null;
  currency: string;
  listingType: string;
  location: string | null;
  isFromOwner: boolean;
  rejectionReason: string | null;
  status: string;
  sourceUrl: string;
  createdAt: string;
  city: { name: string };
  category: { name: string } | null;
  _count: { assignments: number };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const debounceRef = useRef<NodeJS.Timeout>(undefined);
  const [filterOwner, setFilterOwner] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [bulkAssignCustomers, setBulkAssignCustomers] = useState<Array<{ id: string; name: string; surname: string }>>([]);
  const [bulkAssignTarget, setBulkAssignTarget] = useState("");
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [showCategoryChange, setShowCategoryChange] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");

  const fetchListings = useCallback(async (page = 1) => {
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (search) params.set("search", search);
    if (filterOwner) params.set("isFromOwner", filterOwner);
    if (filterStatus) params.set("status", filterStatus);
    if (filterType) params.set("listingType", filterType);

    const res = await fetch(`/api/listings?${params}`);
    if (res.ok) {
      const data = await res.json();
      setListings(data.listings);
      setPagination(data.pagination);
      setSelected(new Set());
    }
  }, [search, filterOwner, filterStatus, filterType]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  async function deleteListing(id: string) {
    if (!confirm("Bu ilanı silmek istediğinize emin misiniz?")) return;
    await fetch(`/api/listings?id=${id}`, { method: "DELETE" });
    toast("Ilan silindi", "info");
    fetchListings(pagination.page);
  }

  async function updateStatus(id: string, status: string) {
    await fetch("/api/listings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    fetchListings(pagination.page);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === listings.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(listings.map((l) => l.id)));
    }
  }

  async function bulkUpdateStatus(status: string) {
    if (selected.size === 0) return;
    if (!confirm(`${selected.size} ilanın durumunu "${status}" olarak değiştirmek istediğinize emin misiniz?`)) return;

    await fetch("/api/listings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected), status }),
    });
    toast(`${selected.size} ilan guncellendi`, "success");
    fetchListings(pagination.page);
  }

  async function bulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`${selected.size} ilani silmek istediginize emin misiniz?`)) return;

    await fetch(`/api/listings?ids=${Array.from(selected).join(",")}`, { method: "DELETE" });
    toast(`${selected.size} ilan silindi`, "info");
    fetchListings(pagination.page);
  }

  async function openBulkAssign() {
    if (bulkAssignCustomers.length === 0) {
      const res = await fetch("/api/customers");
      if (res.ok) setBulkAssignCustomers(await res.json());
    }
    setShowBulkAssign(true);
  }

  async function doBulkAssign() {
    if (!bulkAssignTarget || selected.size === 0) return;
    const res = await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: bulkAssignTarget, listingIds: Array.from(selected) }),
    });
    if (res.ok) {
      const d = await res.json();
      toast(`${d.assigned} ilan atandi`, "success");
    }
    setShowBulkAssign(false);
    setBulkAssignTarget("");
    setSelected(new Set());
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">İlan Yönetimi</h1>
        <a
          href={`/api/listings/export?${new URLSearchParams({
            ...(filterOwner && { isFromOwner: filterOwner }),
            ...(filterStatus && { status: filterStatus }),
            ...(filterType && { listingType: filterType }),
          }).toString()}`}
          download
          className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium hover:bg-[var(--accent)] transition-colors"
        >
          <Download className="h-4 w-4" /> CSV İndir
        </a>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtreler</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <Input
              placeholder="Ara (baslik, konum)..."
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                clearTimeout(debounceRef.current);
                debounceRef.current = setTimeout(() => setSearch(e.target.value), 400);
              }}
              onKeyDown={(e) => { if (e.key === "Enter") { clearTimeout(debounceRef.current); setSearch(searchInput); } }}
            />
            <Select value={filterOwner} onChange={(e) => { setFilterOwner(e.target.value); }}>
              <option value="">Tüm Kaynaklar</option>
              <option value="true">Sahibinden</option>
              <option value="false">Emlakçı</option>
            </Select>
            <Select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); }}>
              <option value="">Tüm Durumlar</option>
              <option value="ACTIVE">Aktif</option>
              <option value="PASSIVE">Pasif</option>
              <option value="SOLD">Satıldı</option>
              <option value="RENTED">Kiralandı</option>
            </Select>
            <Select value={filterType} onChange={(e) => { setFilterType(e.target.value); }}>
              <option value="">Tüm Tipler</option>
              <option value="SALE">Satılık</option>
              <option value="RENT">Kiralık</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Toplu İşlemler */}
      {selected.size > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-lg border border-[var(--primary)] bg-[var(--primary)]/5 px-4 py-3 flex-wrap">
            <span className="text-sm font-medium">{selected.size} ilan secildi</span>
            <div className="flex gap-2 ml-auto flex-wrap">
              <Button size="sm" variant="outline" onClick={openBulkAssign}>
                <UserPlus className="h-3 w-3 mr-1" /> Musteriye Ata
              </Button>
              <Button size="sm" variant="outline" onClick={() => {
                if (categories.length === 0) fetch("/api/cities").then(() => {});
                fetch("/api/listings?limit=1").then((r) => r.json()).then(() => {
                  // Kategorileri DB'den cekmek yerine basit liste
                  setCategories([
                    { id: "daire", name: "Daire" }, { id: "mustakil-ev", name: "Mustakil" },
                    { id: "villa", name: "Villa" }, { id: "arsa", name: "Arsa" },
                  ]);
                });
                setShowCategoryChange(!showCategoryChange);
              }}>Kategori</Button>
              <Button size="sm" variant="outline" onClick={async () => {
                if (!confirm(`${selected.size} ilani tekrar filtrelemek istiyor musunuz?`)) return;
                const res = await fetch("/api/listings/bulk", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "refilter", ids: Array.from(selected) }),
                });
                if (res.ok) { const d = await res.json(); toast(`${d.updated} ilan tekrar filtrelendi`, "success"); }
                fetchListings(pagination.page);
              }}>Tekrar Filtrele</Button>
              <Button size="sm" variant="outline" onClick={() => bulkUpdateStatus("ACTIVE")}>Aktif</Button>
              <Button size="sm" variant="outline" onClick={() => bulkUpdateStatus("PASSIVE")}>Pasif</Button>
              <Button size="sm" variant="destructive" onClick={bulkDelete}>Sil</Button>
              <Button size="sm" variant="ghost" onClick={() => { setSelected(new Set()); setShowBulkAssign(false); setShowCategoryChange(false); }}>Iptal</Button>
            </div>
          </div>
          {showBulkAssign && (
            <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] px-4 py-3">
              <Select value={bulkAssignTarget} onChange={(e) => setBulkAssignTarget(e.target.value)} className="flex-1">
                <option value="">Musteri secin...</option>
                {bulkAssignCustomers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} {c.surname}</option>
                ))}
              </Select>
              <Button size="sm" onClick={doBulkAssign} disabled={!bulkAssignTarget}>
                {selected.size} Ilan Ata
              </Button>
            </div>
          )}
          {showCategoryChange && (
            <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] px-4 py-3">
              <Select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="flex-1">
                <option value="">Kategori secin...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
              <Button size="sm" disabled={!selectedCategory} onClick={async () => {
                const res = await fetch("/api/listings/bulk", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "changeCategory", ids: Array.from(selected), categoryId: selectedCategory }),
                });
                if (res.ok) { const d = await res.json(); toast(`${d.updated} ilanin kategorisi degistirildi`, "success"); }
                setShowCategoryChange(false);
                setSelectedCategory("");
                fetchListings(pagination.page);
              }}>Uygula</Button>
            </div>
          )}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={listings.length > 0 && selected.size === listings.length}
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                </TableHead>
                <TableHead>Başlık</TableHead>
                <TableHead>Fiyat</TableHead>
                <TableHead>Şehir</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Kaynak</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Atama</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listings.map((listing) => (
                <TableRow key={listing.id} className={selected.has(listing.id) ? "bg-[var(--primary)]/5" : ""}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selected.has(listing.id)}
                      onChange={() => toggleSelect(listing.id)}
                      className="rounded"
                    />
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <Link href={`/listings/${listing.id}`} className="truncate font-medium hover:text-[var(--primary)] hover:underline block" title={listing.title}>
                      {listing.title}
                    </Link>
                  </TableCell>
                  <TableCell>{formatPrice(listing.price)}</TableCell>
                  <TableCell>{listing.city.name}</TableCell>
                  <TableCell>{listing.category?.name || "-"}</TableCell>
                  <TableCell>
                    {listing.isFromOwner ? (
                      <Badge variant="success">Sahibinden</Badge>
                    ) : (
                      <Badge variant="destructive" title={listing.rejectionReason || ""}>
                        Emlakçı
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={listing.status}
                      onChange={(e) => updateStatus(listing.id, e.target.value)}
                      className="h-8 text-xs w-28"
                    >
                      <option value="ACTIVE">Aktif</option>
                      <option value="PASSIVE">Pasif</option>
                      <option value="SOLD">Satıldı</option>
                      <option value="RENTED">Kiralandı</option>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{listing._count.assignments}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{formatDate(listing.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Link
                        href={`/listings/${listing.id}`}
                        className="p-1 hover:bg-[var(--accent)] rounded"
                        title="Detay"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      <a
                        href={listing.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 hover:bg-[var(--accent)] rounded"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <button
                        onClick={() => deleteListing(listing.id)}
                        className="p-1 hover:bg-red-50 rounded text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {listings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-[var(--muted-foreground)]">
                    İlan bulunamadı
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--muted-foreground)]">
            Toplam {pagination.total} ilan
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => fetchListings(pagination.page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchListings(pagination.page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
