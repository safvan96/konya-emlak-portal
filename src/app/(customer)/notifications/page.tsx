"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Notification {
  id: string;
  details: string;
  createdAt: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => { setNotifications(data); setLoading(false); });
  }, []);

  if (loading) return <div className="p-8 text-center text-[var(--muted-foreground)]">Yukleniyor...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-3xl font-bold">Bildirimler</h1>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-[var(--muted-foreground)]">
            Bildiriminiz bulunmuyor.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <Card key={n.id}>
              <CardContent className="p-4 flex items-start gap-3">
                <Bell className="h-5 w-5 text-[var(--primary)] shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm">{n.details}</p>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">{formatDate(n.createdAt)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
