"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { Play } from "lucide-react";

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

export default function ScraperPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [runs, setRuns] = useState<ScraperRun[]>([]);
  const [selectedCity, setSelectedCity] = useState("");
  const [listingType, setListingType] = useState("SALE");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/cities").then((r) => r.json()).then(setCities);
    fetchRuns();
  }, []);

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
      body: JSON.stringify({ citySlug: selectedCity, listingType, maxPages: 3 }),
    });
    setLoading(false);
    // Birkaç saniye sonra durumu kontrol et
    setTimeout(fetchRuns, 5000);
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
            <Button onClick={startScraper} disabled={!selectedCity || loading}>
              <Play className="h-4 w-4 mr-2" />
              {loading ? "Başlatılıyor..." : "Başlat"}
            </Button>
            <Button variant="outline" onClick={fetchRuns}>Yenile</Button>
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
                  <TableCell>{statusBadge(run.status)}</TableCell>
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
    </div>
  );
}
