"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Server, Database, Clock, Shield } from "lucide-react";

interface HealthData {
  status: string;
  timestamp: string;
  uptime: number;
  db: string;
}

export default function SettingsPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [stats, setStats] = useState<{ users: number; listings: number; logs: number } | null>(null);

  useEffect(() => {
    fetch("/api/health").then((r) => r.ok ? r.json() : null).then(setHealth);
    // Basit DB istatistikleri
    fetch("/api/dashboard").then((r) => r.ok ? r.json() : null).then((d) => {
      if (d) setStats({ users: d.totalCustomers + 1, listings: d.totalListings, logs: 0 });
    });
  }, []);

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d}g ${h}s ${m}dk`;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Sistem Ayarlari</h1>

      {/* Sistem Durumu */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Server className="h-5 w-5 text-[var(--muted-foreground)]" />
            <div>
              <p className="text-xs text-[var(--muted-foreground)]">Sunucu</p>
              {health ? (
                <Badge variant={health.status === "ok" ? "success" : "destructive"}>
                  {health.status === "ok" ? "Çalışıyor" : "Hata"}
                </Badge>
              ) : <p className="text-sm">Yükleniyor...</p>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Database className="h-5 w-5 text-[var(--muted-foreground)]" />
            <div>
              <p className="text-xs text-[var(--muted-foreground)]">Veritabanı</p>
              {health ? (
                <Badge variant={health.db === "connected" ? "success" : "destructive"}>
                  {health.db === "connected" ? "Bağlı" : "Bağlantı Yok"}
                </Badge>
              ) : <p className="text-sm">Yükleniyor...</p>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-[var(--muted-foreground)]" />
            <div>
              <p className="text-xs text-[var(--muted-foreground)]">Uptime</p>
              <p className="text-sm font-medium">{health ? formatUptime(health.uptime) : "-"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Shield className="h-5 w-5 text-[var(--muted-foreground)]" />
            <div>
              <p className="text-xs text-[var(--muted-foreground)]">Versiyon</p>
              <p className="text-sm font-medium">v1.0.0</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Yapilandirma */}
      <Card>
        <CardHeader>
          <CardTitle>Scraper Yapilandirmasi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 text-sm">
            <div className="space-y-3">
              <div className="flex justify-between border-b border-[var(--border)] pb-2">
                <span className="text-[var(--muted-foreground)]">Zamanlayici</span>
                <span className="font-medium">08:00 ve 20:00 (gunluk)</span>
              </div>
              <div className="flex justify-between border-b border-[var(--border)] pb-2">
                <span className="text-[var(--muted-foreground)]">Min Gecikme</span>
                <span className="font-medium">{process.env.NEXT_PUBLIC_SCRAPER_DELAY_MIN || "2000"}ms</span>
              </div>
              <div className="flex justify-between border-b border-[var(--border)] pb-2">
                <span className="text-[var(--muted-foreground)]">Max Gecikme</span>
                <span className="font-medium">{process.env.NEXT_PUBLIC_SCRAPER_DELAY_MAX || "5000"}ms</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between border-b border-[var(--border)] pb-2">
                <span className="text-[var(--muted-foreground)]">Varsayilan Sayfa</span>
                <span className="font-medium">3 sayfa</span>
              </div>
              <div className="flex justify-between border-b border-[var(--border)] pb-2">
                <span className="text-[var(--muted-foreground)]">Retry</span>
                <span className="font-medium">2 deneme</span>
              </div>
              <div className="flex justify-between border-b border-[var(--border)] pb-2">
                <span className="text-[var(--muted-foreground)]">Otomatik Atama</span>
                <Badge variant="success">Aktif</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Guvenlik */}
      <Card>
        <CardHeader>
          <CardTitle>Guvenlik</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 text-sm">
            <div className="space-y-3">
              <div className="flex justify-between border-b border-[var(--border)] pb-2">
                <span className="text-[var(--muted-foreground)]">Login Rate Limit</span>
                <span className="font-medium">10 / dakika</span>
              </div>
              <div className="flex justify-between border-b border-[var(--border)] pb-2">
                <span className="text-[var(--muted-foreground)]">Şifre Değiştirme Limit</span>
                <span className="font-medium">5 / 15 dakika</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between border-b border-[var(--border)] pb-2">
                <span className="text-[var(--muted-foreground)]">Auth</span>
                <span className="font-medium">JWT + Credentials</span>
              </div>
              <div className="flex justify-between border-b border-[var(--border)] pb-2">
                <span className="text-[var(--muted-foreground)]">IP Loglama</span>
                <Badge variant="success">Aktif</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Kisayollar */}
      <Card>
        <CardHeader>
          <CardTitle>Klavye Kisayollari</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2 text-sm">
            {[
              ["G D", "Dashboard"],
              ["G L", "Ilanlar"],
              ["G M", "Musteriler"],
              ["G A", "Atamalar"],
              ["G S", "Scraper"],
              ["G I", "Istatistikler"],
            ].map(([key, label]) => (
              <div key={key} className="flex items-center gap-3">
                <kbd className="px-2 py-1 rounded bg-[var(--muted)] text-xs font-mono">{key}</kbd>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
