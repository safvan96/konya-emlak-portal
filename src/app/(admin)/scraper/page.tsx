"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { Play, Plus, X, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

interface City {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

interface ScraperRun {
  id: string;
  cityId: string;
  totalFound: number;
  accepted: number;
  rejected: number;
  duplicates: number;
  errors: number;
  duration: number | null;
  status: string;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

interface BlacklistKeyword {
  id: string;
  keyword: string;
}

export default function ScraperPage() {
  const { toast } = useToast();
  const [cities, setCities] = useState<City[]>([]);
  const [runs, setRuns] = useState<ScraperRun[]>([]);
  const [selectedCity, setSelectedCity] = useState("");
  const [listingType, setListingType] = useState("SALE");
  const [maxPages, setMaxPages] = useState(3);
  const [loading, setLoading] = useState(false);
  const [keywords, setKeywords] = useState<BlacklistKeyword[]>([]);
  const [newKeyword, setNewKeyword] = useState("");

  useEffect(() => {
    fetch("/api/cities").then((r) => r.json()).then(setCities);
    fetchRuns();
    fetchKeywords();
  }, []);

  async function fetchKeywords() {
    const res = await fetch("/api/blacklist");
    if (res.ok) setKeywords(await res.json());
  }

  async function addKeyword() {
    if (!newKeyword.trim()) return;
    const res = await fetch("/api/blacklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword: newKeyword }),
    });
    if (res.ok) {
      setNewKeyword("");
      fetchKeywords();
      toast("Kelime eklendi", "success");
    } else {
      const d = await res.json();
      toast(d.error || "Hata", "error");
    }
  }

  async function deleteKeyword(id: string) {
    await fetch(`/api/blacklist?id=${id}`, { method: "DELETE" });
    toast("Kelime silindi", "info");
    fetchKeywords();
  }

  async function fetchRuns() {
    const res = await fetch("/api/scraper");
    if (res.ok) setRuns(await res.json());
  }

  async function startScraper() {
    if (!selectedCity) return;
    setLoading(true);
    await fetch("/api/scraper", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ citySlug: selectedCity, listingType, maxPages }),
    });
    setLoading(false);
    toast("Scraping başlatıldı", "success");
    fetchRuns();
    // Çalışıyorken her 10 saniyede bir otomatik yenile
    const interval = setInterval(async () => {
      const res = await fetch("/api/scraper");
      if (res.ok) {
        const data = await res.json();
        setRuns(data);
        // Çalışan yoksa durdur
        if (!data.some((r: ScraperRun) => r.status === "running")) {
          clearInterval(interval);
        }
      }
    }, 10000);
    // 5 dakika sonra otomatik durdur
    setTimeout(() => clearInterval(interval), 5 * 60 * 1000);
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case "completed": return <Badge variant="success">Tamamlandı</Badge>;
      case "running": return <Badge variant="warning">Çalışıyor</Badge>;
      case "failed": return <Badge variant="destructive">Hata</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Scraper Yönetimi</h1>

      <Card>
        <CardHeader>
          <CardTitle>Manuel Scraping</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-1 block">Şehir</label>
              <Select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)}>
                <option value="">Şehir seçin...</option>
                {cities.filter((c) => c.isActive).map((c) => (
                  <option key={c.slug} value={c.slug}>{c.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Tip</label>
              <Select value={listingType} onChange={(e) => setListingType(e.target.value)}>
                <option value="SALE">Satılık</option>
                <option value="RENT">Kiralık</option>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Sayfa</label>
              <Select value={String(maxPages)} onChange={(e) => setMaxPages(Number(e.target.value))}>
                <option value="1">1</option>
                <option value="3">3</option>
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="20">20</option>
              </Select>
            </div>
            <Button onClick={startScraper} disabled={!selectedCity || loading}>
              <Play className="h-4 w-4 mr-2" />
              {loading ? "Başlatılıyor..." : "Başlat"}
            </Button>
            <Button variant="outline" onClick={fetchRuns}>
              <RefreshCw className="h-4 w-4 mr-2" />Yenile
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scraping Geçmişi</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Durum</TableHead>
                <TableHead>Bulunan</TableHead>
                <TableHead>Kabul</TableHead>
                <TableHead>Red</TableHead>
                <TableHead>Tekrar</TableHead>
                <TableHead>Hata</TableHead>
                <TableHead>Süre</TableHead>
                <TableHead>Başlangıç</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.id}>
                  <TableCell>
                    {statusBadge(run.status)}
                    {run.errorMessage && (
                      <p className="text-xs text-red-500 mt-1 max-w-[150px] truncate" title={run.errorMessage}>
                        {run.errorMessage}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>{run.totalFound}</TableCell>
                  <TableCell className="text-green-600 font-medium">{run.accepted}</TableCell>
                  <TableCell className="text-red-500">{run.rejected}</TableCell>
                  <TableCell>{run.duplicates}</TableCell>
                  <TableCell className="text-red-500">{run.errors}</TableCell>
                  <TableCell>{run.duration ? `${(run.duration / 1000).toFixed(0)}s` : "-"}</TableCell>
                  <TableCell className="text-xs">{formatDate(run.startedAt)}</TableCell>
                </TableRow>
              ))}
              {runs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-[var(--muted-foreground)]">
                    Henüz scraping çalıştırılmamış
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {/* Blacklist Kelime Yönetimi */}
      <Card>
        <CardHeader>
          <CardTitle>Emlakçı Filtre Kelimeleri (Blacklist)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Yeni kelime ekle..."
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addKeyword()}
              className="max-w-xs"
            />
            <Button onClick={addKeyword} disabled={!newKeyword.trim()}>
              <Plus className="h-4 w-4 mr-2" /> Ekle
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {keywords.map((kw) => (
              <Badge key={kw.id} variant="secondary" className="px-3 py-1.5 text-sm gap-2">
                {kw.keyword}
                <button onClick={() => deleteKeyword(kw.id)} className="hover:text-red-500 transition-colors">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {keywords.length === 0 && (
              <span className="text-sm text-[var(--muted-foreground)]">Henüz blacklist kelimesi yok</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
