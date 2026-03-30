"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";

interface City {
  id: string;
  name: string;
  slug: string;
  sahibindenCityId: string | null;
  isActive: boolean;
  _count: { listings: number };
}

export default function CitiesPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [cityId, setCityId] = useState("");

  useEffect(() => {
    fetchCities();
  }, []);

  async function fetchCities() {
    const res = await fetch("/api/cities");
    if (res.ok) setCities(await res.json());
  }

  async function addCity(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/cities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, sahibindenCityId: cityId }),
    });
    setName("");
    setCityId("");
    setShowForm(false);
    fetchCities();
  }

  async function toggleCity(id: string, isActive: boolean) {
    await fetch("/api/cities", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isActive: !isActive }),
    });
    fetchCities();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Şehir Yönetimi</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          Şehir Ekle
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Yeni Şehir</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={addCity} className="flex gap-4">
              <Input placeholder="Şehir adı" value={name} onChange={(e) => setName(e.target.value)} required />
              <Input placeholder="Sahibinden şehir ID (opsiyonel)" value={cityId} onChange={(e) => setCityId(e.target.value)} />
              <Button type="submit">Ekle</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Şehir</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Sahibinden ID</TableHead>
                <TableHead>İlan Sayısı</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cities.map((city) => (
                <TableRow key={city.id}>
                  <TableCell className="font-medium">{city.name}</TableCell>
                  <TableCell className="text-xs">{city.slug}</TableCell>
                  <TableCell>{city.sahibindenCityId || "-"}</TableCell>
                  <TableCell><Badge variant="secondary">{city._count.listings}</Badge></TableCell>
                  <TableCell>
                    <button onClick={() => toggleCity(city.id, city.isActive)}>
                      <Badge variant={city.isActive ? "success" : "destructive"}>
                        {city.isActive ? "Aktif" : "Pasif"}
                      </Badge>
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
