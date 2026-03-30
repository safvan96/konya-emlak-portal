"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ProfilePage() {
  const { data: session } = useSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const res = await fetch("/api/profile/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (res.ok) {
      setMessage("Şifre başarıyla değiştirildi");
      setCurrentPassword("");
      setNewPassword("");
    } else {
      const data = await res.json();
      setMessage(data.error || "Bir hata oluştu");
    }
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
              <div className={`p-3 text-sm rounded-md border ${message.includes("başarı") ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-500 border-red-200"}`}>
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
              placeholder="Yeni şifre"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
            />
            <Button type="submit">Şifreyi Değiştir</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
