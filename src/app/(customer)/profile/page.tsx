"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    const res = await fetch("/api/profile/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    setLoading(false);

    if (res.ok) {
      setMessage("Şifre başarıyla değiştirildi");
      setIsSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
    } else {
      const data = await res.json();
      setMessage(data.error || "Bir hata oluştu");
      setIsSuccess(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="space-y-6 max-w-lg">
        <Skeleton className="h-9 w-32" />
        <Card>
          <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-3xl font-bold">Profil</h1>

      <Card>
        <CardHeader>
          <CardTitle>Hesap Bilgileri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-sm text-[var(--muted-foreground)]">Ad Soyad</label>
            <p className="font-medium">{session?.user?.name} {session?.user?.surname}</p>
          </div>
          <div>
            <label className="text-sm text-[var(--muted-foreground)]">Email</label>
            <p className="font-medium">{session?.user?.email}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Şifre Değiştir</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            {message && (
              <div className={`p-3 text-sm rounded-md border ${isSuccess ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-500 border-red-200"}`}>
                {message}
              </div>
            )}
            <Input
              type="password"
              placeholder="Mevcut şifre"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Yeni şifre (en az 6 karakter)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
            />
            <Button type="submit" disabled={loading}>
              {loading ? "Değiştiriliyor..." : "Şifreyi Değiştir"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
