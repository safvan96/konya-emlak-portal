"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Settings, Check } from "lucide-react";

interface City { id: string; name: string; }
interface Category { id: string; name: string; }

export default function PreferencesPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [listingType, setListingType] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [autoAssign, setAutoAssign] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/cities").then((r) => r.json()),
      fetch("/api/preferences").then((r) => r.ok ? r.json() : null),
    ]).then(([citiesData, prefs]) => {
      setCities(citiesData);
      // Kategorileri listings API'den almak yerine sabit kullanalim
      setCategories([
        { id: "daire", name: "Daire" }, { id: "mustakil-ev", name: "Müstakil Ev" },
        { id: "villa", name: "Villa" }, { id: "arsa", name: "Arsa" },
        { id: "tarla", name: "Tarla" }, { id: "dukkan", name: "Dükkan" },
        { id: "ofis", name: "Ofis" }, { id: "depo", name: "Depo" },
      ]);
      if (prefs) {
        setSelectedCities(prefs.cityIds || []);
        setSelectedCategories(prefs.categoryIds || []);
        setListingType(prefs.listingType || "");
        setPriceMin(prefs.priceMin ? String(prefs.priceMin) : "");
        setPriceMax(prefs.priceMax ? String(prefs.priceMax) : "");
        setAutoAssign(prefs.autoAssign || false);
      }
      setLoading(false);
    });
  }, []);

  async function save() {
    await fetch("/api/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cityIds: selectedCities,
        categoryIds: selectedCategories,
        listingType: listingType || null,
        priceMin: priceMin ? Number(priceMin) : null,
        priceMax: priceMax ? Number(priceMax) : null,
        autoAssign,
      }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function toggleCity(id: string) {
    setSelectedCities((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);
  }

  function toggleCategory(id: string) {
    setSelectedCategories((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);
  }

  if (loading) return <div className="p-8 text-center text-[var(--muted-foreground)]">Yükleniyor...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-3xl font-bold">Tercihlerim</h1>
      <p className="text-[var(--muted-foreground)]">
        Tercihlerinize göre yeni ilanlar otomatik olarak size atanabilir.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> İlan Tercihleri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Şehirler */}
          <div>
            <label className="text-sm font-medium mb-2 block">Şehirler</label>
            <div className="flex flex-wrap gap-2">
              {cities.map((c) => (
                <button
                  key={c.id}
                  onClick={() => toggleCity(c.id)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    selectedCities.includes(c.id)
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
                      : "border-[var(--border)] hover:bg-[var(--accent)]"
                  }`}
                >
                  {c.name}
                </button>
              ))}
              {selectedCities.length === 0 && <span className="text-xs text-[var(--muted-foreground)]">Tüm şehirler</span>}
            </div>
          </div>

          {/* Kategoriler */}
          <div>
            <label className="text-sm font-medium mb-2 block">Kategoriler</label>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => toggleCategory(c.id)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    selectedCategories.includes(c.id)
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
                      : "border-[var(--border)] hover:bg-[var(--accent)]"
                  }`}
                >
                  {c.name}
                </button>
              ))}
              {selectedCategories.length === 0 && <span className="text-xs text-[var(--muted-foreground)]">Tüm kategoriler</span>}
            </div>
          </div>

          {/* Tip */}
          <div>
            <label className="text-sm font-medium mb-2 block">İlan Tipi</label>
            <Select value={listingType} onChange={(e) => setListingType(e.target.value)} className="max-w-xs">
              <option value="">Hepsi</option>
              <option value="SALE">Satılık</option>
              <option value="RENT">Kiralık</option>
            </Select>
          </div>

          {/* Fiyat Aralığı */}
          <div>
            <label className="text-sm font-medium mb-2 block">Fiyat Aralığı</label>
            <div className="flex gap-3 items-center max-w-md">
              <Input type="number" placeholder="Min" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} />
              <span className="text-[var(--muted-foreground)]">-</span>
              <Input type="number" placeholder="Max" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} />
            </div>
          </div>

          {/* Otomatik Atama */}
          <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] p-4">
            <input
              type="checkbox"
              id="autoAssign"
              checked={autoAssign}
              onChange={(e) => setAutoAssign(e.target.checked)}
              className="rounded h-4 w-4"
            />
            <div>
              <label htmlFor="autoAssign" className="text-sm font-medium cursor-pointer">Otomatik Atama</label>
              <p className="text-xs text-[var(--muted-foreground)]">
                Tercihlerinize uyan yeni ilanlar otomatik olarak size atansın
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={save}>Kaydet</Button>
            {saved && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <Check className="h-4 w-4" /> Kaydedildi
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
