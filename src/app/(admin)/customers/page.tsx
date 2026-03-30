"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { Plus, Trash2, Edit, X } from "lucide-react";

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

  useEffect(() => {
    fetchCustomers();
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

  function startEdit(customer: Customer) {
    setEditId(customer.id);
    setForm({ name: customer.name, surname: customer.surname, email: customer.email, password: "" });
    setShowForm(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Müşteri Yönetimi</h1>
        <Button onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ name: "", surname: "", email: "", password: "" }); }}>
          {showForm ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          {showForm ? "İptal" : "Yeni Müşteri"}
        </Button>
      </div>

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
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name} {c.surname}</TableCell>
                  <TableCell>{c.email}</TableCell>
                  <TableCell>
                    <button onClick={() => toggleActive(c.id, c.isActive)}>
                      <Badge variant={c.isActive ? "success" : "destructive"}>
                        {c.isActive ? "Aktif" : "Pasif"}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{c._count.assignments}</Badge></TableCell>
                  <TableCell><Badge variant="secondary">{c._count.favorites}</Badge></TableCell>
                  <TableCell className="text-xs">{formatDate(c.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(c)} className="p-1 hover:bg-[var(--accent)] rounded">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button onClick={() => deleteCustomer(c.id)} className="p-1 hover:bg-red-50 rounded text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {customers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-[var(--muted-foreground)]">
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
