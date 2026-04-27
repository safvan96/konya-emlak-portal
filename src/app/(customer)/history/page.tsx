"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";

interface ViewLog {
  id: string;
  details: string | null;
  createdAt: string;
}

export default function HistoryPage() {
  const [logs, setLogs] = useState<ViewLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => { setLogs(data); setLoading(false); });
  }, []);

  if (loading) return <div className="p-8 text-center text-[var(--muted-foreground)]">Yükleniyor...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-3xl font-bold">Görüntüleme Geçmişi</h1>

      {logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-[var(--muted-foreground)]">
            Henüz ilan görüntülemediniz.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(
            logs.reduce((acc: Record<string, ViewLog[]>, log) => {
              const d = new Date(log.createdAt);
              const today = new Date();
              const yesterday = new Date(today.getTime() - 86400000);
              let key: string;
              if (d.toDateString() === today.toDateString()) key = "Bugün";
              else if (d.toDateString() === yesterday.toDateString()) key = "Dün";
              else key = d.toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
              (acc[key] ||= []).push(log);
              return acc;
            }, {})
          ).map(([dateKey, items]) => (
            <div key={dateKey} className="space-y-2">
              <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">{dateKey}</h3>
              <div className="space-y-2">
                {items.map((log) => {
                  const title = log.details?.replace("İlan görüntülendi: ", "") || "Bilinmeyen ilan";
                  return (
                    <Card key={log.id}>
                      <CardContent className="p-4 flex items-center gap-3">
                        <Clock className="h-4 w-4 text-[var(--muted-foreground)] shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{title}</p>
                          <p className="text-xs text-[var(--muted-foreground)]">{new Date(log.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
