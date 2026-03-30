"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPrice, formatDate } from "@/lib/utils";
import { Trash2, Plus, Search } from "lucide-react";

interface Customer {
  id: string;
  name: string;
  surname: string;
  email: string;
}

interface Assignment {
  id: string;
  assignedAt: string;
  user: { id: string; name: string; surname: string; email: string };
  listing: {
    id: string;
    title: string;
    price: number | null;
    location: string | null;
    city: { name: string };
    category: { name: string } | null;
  };
}

interface Listing {
  id: string;
  title: string;
  price: number | null;
  location: string | null;
  city: { name: string };
}

export default function AssignmentsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [availableListings, setAvailableListings] = useState<Listing[]>([]);
  const [selectedListings, setSelectedListings] = useState<string[]>([]);
  const [listingSearch, setListingSearch] = useState("");

  useEffect(() => {
    fetch("/api/customers").then((r) => r.json()).then(setCustomers);
  }, []);

  const fetchAssignments = useCallback(async () => {
    if (!selectedCustomer) return;
    const res = await fetch(`/api/assignments?userId=${selectedCustomer}`);
    if (res.ok) setAssignments(await res.json());
  }, [selectedCustomer]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  async function searchListings() {
    const params = new URLSearchParams({ search: listingSearch, isFromOwner: "true", status: "ACTIVE", limit: "50" });
    const res = await fetch(`/api/listings?${params}`);
    if (res.ok) {
      const data = await res.json();
      setAvailableListings(data.listings);
    }
  }

  async function assignListings() {
    if (!selectedCustomer || selectedListings.length === 0) return;

    await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedCustomer, listingIds: selectedListings }),
    });

    setSelectedListings([]);
    setShowAssignForm(false);
    fetchAssignments();
  }

  async function removeAssignment(id: string) {
    await fetch(`/api/assignments?id=${id}`, { method: "DELETE" });
    fetchAssignments();
  }

  function toggleListing(id: string) {
    setSelectedListings((prev) =>
      prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]
    );
  }

  const selectedCustomerName = customers.find((c) => c.id === selectedCustomer);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">İlan Atama</h1>

      <Card>
        <CardHeader>
          <CardTitle>Müşteri Seç</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)}>
            <option value="">Müşteri seçin...</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.surname} ({c.email})
              </option>
            ))}
          </Select>
        </CardContent>
      </Card>

      {selectedCustomer && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {selectedCustomerName?.name} {selectedCustomerName?.surname} - Atanmış İlanlar ({assignments.length})
            </h2>
            <Button onClick={() => setShowAssignForm(!showAssignForm)}>
              <Plus className="h-4 w-4 mr-2" />
              İlan Ata
            </Button>
          </div>

          {showAssignForm && (
            <Card>
              <CardHeader>
                <CardTitle>İlan Ara ve Ata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="İlan ara (başlık, konum)..."
                    value={listingSearch}
                    onChange={(e) => setListingSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchListings()}
                  />
                  <Button onClick={searchListings}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>

                {availableListings.length > 0 && (
                  <div className="max-h-64 overflow-y-auto border rounded-md">
                    {availableListings.map((l) => (
                      <label
                        key={l.id}
                        className="flex items-center gap-3 p-3 border-b last:border-0 hover:bg-[var(--accent)] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedListings.includes(l.id)}
                          onChange={() => toggleListing(l.id)}
                          className="rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{l.title}</p>
                          <p className="text-xs text-[var(--muted-foreground)]">
                            {l.city.name} - {formatPrice(l.price)}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                {selectedListings.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{selectedListings.length} ilan seçildi</span>
                    <Button onClick={assignListings}>Seçilenleri Ata</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>İlan</TableHead>
                    <TableHead>Fiyat</TableHead>
                    <TableHead>Şehir</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Atanma Tarihi</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="max-w-[250px]">
                        <div className="truncate font-medium">{a.listing.title}</div>
                      </TableCell>
                      <TableCell>{formatPrice(a.listing.price)}</TableCell>
                      <TableCell>{a.listing.city.name}</TableCell>
                      <TableCell>{a.listing.category?.name || "-"}</TableCell>
                      <TableCell className="text-xs">{formatDate(a.assignedAt)}</TableCell>
                      <TableCell>
                        <button
                          onClick={() => removeAssignment(a.id)}
                          className="p-1 hover:bg-red-50 rounded text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {assignments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-[var(--muted-foreground)]">
                        Bu müşteriye henüz ilan atanmamış
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
