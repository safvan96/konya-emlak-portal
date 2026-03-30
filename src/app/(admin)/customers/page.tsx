"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { Plus, Trash2, Edit, X, Link2, Download, Upload } from "lucide-react";
import Link from "next/link";
import { TableSkeleton } from "@/components/ui/skeleton";

interface Customer {
  id: string;
  email: string;
  name: string;
  surname: string;
  isActive: boolean;
  createdAt: string;
  _count: { assignments: number; favorites: number };
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", surname: "", email: "", password: "" });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importResult, setImportResult] = useState<string | null>(null);

  useEffect(() => {
    fetchCustomers().finally(() => setLoading(false));
  }, []);

  async function fetchCustomers() {
    const res = await fetch("/api/customers");
    if (res.ok) setCustomers(await res.json());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (editId) {
      await fetch("/api/customers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editId, ...form, password: form.password || undefined }),
      });
    } else {
      await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }

    setForm({ name: "", surname: "", email: "", password: "" });
    setShowForm(false);
    setEditId(null);
    fetchCustomers();
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch("/api/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isActive: !isActive }),
    });
    fetchCustomers();
  }

  async function deleteCustomer(id: string) {
    if (!confirm("Bu müşteriyi silmek istediğinize emin misiniz?")) return;
    await fetch(`/api/customers?id=${id}`, { method: "DELETE" });
    fetchCustomers();
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function bulkToggleActive(isActive: boolean) {
    if (selected.size === 0) return;
    await Promise.all(
      Array.from(selected).map((id) =>
        fetch("/api/customers", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, isActive }),
        })
      )
    );
    setSelected(new Set());
    fetchCustomers();
  }

  async function bulkDeleteCustomers() {
    if (!confirm(`${selected.size} musteriyi silmek istediginize emin misiniz?`)) return;
    await Promise.all(
      Array.from(selected).map((id) =>
        fetch(`/api/customers?id=${id}`, { method: "DELETE" })
      )
    );
    setSelected(new Set());
    fetchCustomers();
  }

  function startEdit(customer: Customer) {
    setEditId(customer.id);
    setForm({ name: customer.name, surname: customer.surname, email: customer.email, password: "" });
    setShowForm(true);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Müşteri Yönetimi</h1>
        <Card><CardContent className="p-0"><TableSkeleton rows={5} cols={7} /></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Musteri Yonetimi</h1>
        <div className="flex gap-2">
          <label className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium hover:bg-[var(--accent)] transition-colors cursor-pointer">
            <Upload className="h-4 w-4" /> Import
            <input type="file" accept=".csv" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const form = new FormData();
              form.append("file", file);
              const res = await fetch("/api/customers/import", { method: "POST", body: form });
              const data = await res.json();
              setImportResult(`${data.created} eklendi, ${data.skipped} atlandi, ${data.errors} hata`);
              fetchCustomers();
              e.target.value = "";
              setTimeout(() => setImportResult(null), 5000);
            }} />
          </label>
          <a
            href="/api/customers/export"
            download
            className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium hover:bg-[var(--accent)] transition-colors"
          >
            <Download className="h-4 w-4" /> Export
          </a>
          <Button onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ name: "", surname: "", email: "", password: "" }); }}>
            {showForm ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            {showForm ? "Iptal" : "Yeni Musteri"}
          </Button>
        </div>
      </div>

      {importResult && (
        <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          {importResult}
        </div>
      )}

      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-[var(--primary)] bg-[var(--primary)]/5 px-4 py-3">
          <span className="text-sm font-medium">{selected.size} musteri secildi</span>
          <div className="flex gap-2 ml-auto">
            <Button size="sm" variant="outline" onClick={() => bulkToggleActive(true)}>Aktif Yap</Button>
            <Button size="sm" variant="outline" onClick={() => bulkToggleActive(false)}>Pasif Yap</Button>
            <Button size="sm" variant="destructive" onClick={bulkDeleteCustomers}>Sil</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Iptal</Button>
          </div>
        </div>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editId ? "Müşteri Düzenle" : "Yeni Müşteri"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <Input placeholder="Ad" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <Input placeholder="Soyad" value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} required />
              <Input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              <Input type="password" placeholder={editId ? "Yeni şifre (boş bırakılabilir)" : "Şifre"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editId} />
              <div className="md:col-span-2">
                <Button type="submit">{editId ? "Güncelle" : "Oluştur"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input type="checkbox"
                    checked={customers.length > 0 && selected.size === customers.length}
                    onChange={() => selected.size === customers.length ? setSelected(new Set()) : setSelected(new Set(customers.map((c) => c.id)))}
                    className="rounded"
                  />
                </TableHead>
                <TableHead>Ad Soyad</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Atanmış İlan</TableHead>
                <TableHead>Favori</TableHead>
                <TableHead>Kayıt</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.id} className={selected.has(c.id) ? "bg-[var(--primary)]/5" : ""}>
                  <TableCell>
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} className="rounded" />
                  </TableCell>
                  <TableCell>
                    <Link href={`/customers/${c.id}`} className="font-medium hover:text-[var(--primary)] hover:underline">
                      {c.name} {c.surname}
                    </Link>
                  </TableCell>
                  <TableCell>{c.email}</TableCell>
                  <TableCell>
                    <button onClick={() => toggleActive(c.id, c.isActive)}>
                      <Badge variant={c.isActive ? "success" : "destructive"}>
                        {c.isActive ? "Aktif" : "Pasif"}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell>
                    <Link href={`/assignments?customer=${c.id}`} className="hover:underline">
                      <Badge variant="secondary">{c._count.assignments}</Badge>
                    </Link>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{c._count.favorites}</Badge></TableCell>
                  <TableCell className="text-xs">{formatDate(c.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Link href={`/assignments?customer=${c.id}`} className="p-1 hover:bg-[var(--accent)] rounded" title="Atanmış İlanlar">
                        <Link2 className="h-4 w-4" />
                      </Link>
                      <button onClick={() => startEdit(c)} className="p-1 hover:bg-[var(--accent)] rounded" title="Düzenle">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button onClick={() => deleteCustomer(c.id)} className="p-1 hover:bg-red-50 rounded text-red-500" title="Sil">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {customers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-[var(--muted-foreground)]">
                    Henüz müşteri yok
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
