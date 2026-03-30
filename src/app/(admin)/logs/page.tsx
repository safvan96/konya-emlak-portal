"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Log {
  id: string;
  action: string;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; name: string; surname: string; email: string; role: string };
}

const ACTION_LABELS: Record<string, string> = {
  LOGIN: "Giriş",
  LOGOUT: "Çıkış",
  VIEW_LISTING: "İlan Görüntüleme",
  ASSIGN_LISTINGS: "İlan Atama",
  SCRAPER_TRIGGERED: "Scraper Tetikleme",
  FAVORITE_ADD: "Favorilere Ekleme",
  FAVORITE_REMOVE: "Favorilerden Çıkarma",
};

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [filterAction, setFilterAction] = useState("");

  const fetchLogs = useCallback(async (p = 1) => {
    const params = new URLSearchParams({ page: String(p), limit: "50" });
    if (filterAction) params.set("action", filterAction);
    const res = await fetch(`/api/logs?${params}`);
    if (res.ok) {
      const data = await res.json();
      setLogs(data.logs);
      setPage(data.pagination.page);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    }
  }, [filterAction]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Kullanıcı Logları</h1>

      <div className="flex gap-4">
        <Select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className="w-48">
          <option value="">Tüm Aksiyonlar</option>
          {Object.entries(ACTION_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kullanıcı</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Aksiyon</TableHead>
                <TableHead>Detay</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Tarih</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">{log.user.name} {log.user.surname}</TableCell>
                  <TableCell>
                    <Badge variant={log.user.role === "ADMIN" ? "default" : "secondary"}>
                      {log.user.role === "ADMIN" ? "Admin" : "Müşteri"}
                    </Badge>
                  </TableCell>
                  <TableCell>{ACTION_LABELS[log.action] || log.action}</TableCell>
                  <TableCell className="max-w-[300px]">
                    <span className="text-xs truncate block">{log.details || "-"}</span>
                  </TableCell>
                  <TableCell className="text-xs">{log.ipAddress || "-"}</TableCell>
                  <TableCell className="text-xs">{formatDate(log.createdAt)}</TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-[var(--muted-foreground)]">
                    Log bulunamadı
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--muted-foreground)]">Toplam {total} kayıt</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => fetchLogs(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => fetchLogs(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
