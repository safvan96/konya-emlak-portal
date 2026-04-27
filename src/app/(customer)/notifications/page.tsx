"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Bell } from "lucide-react";

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

  if (loading) return <div className="p-8 text-center text-[var(--muted-foreground)]">Yükleniyor...</div>;

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
        <div className="space-y-4">
          {Object.entries(
            notifications.reduce((acc: Record<string, Notification[]>, n) => {
              const d = new Date(n.createdAt);
              const today = new Date();
              const yesterday = new Date(today.getTime() - 86400000);
              let key: string;
              if (d.toDateString() === today.toDateString()) key = "Bugün";
              else if (d.toDateString() === yesterday.toDateString()) key = "Dün";
              else key = d.toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
              (acc[key] ||= []).push(n);
              return acc;
            }, {})
          ).map(([dateKey, items]) => (
            <div key={dateKey} className="space-y-2">
              <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">{dateKey}</h3>
              <div className="space-y-2">
                {items.map((n) => (
                  <Card key={n.id}>
                    <CardContent className="p-4 flex items-start gap-3">
                      <Bell className="h-5 w-5 text-[var(--primary)] shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm">{n.details}</p>
                        <p className="text-xs text-[var(--muted-foreground)] mt-1">{new Date(n.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
