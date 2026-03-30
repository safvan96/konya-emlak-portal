"use client";

import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink } from "lucide-react";

// Sahibinden.com ilan onizleme (iframe)
export default function ListingPreviewPage() {
  const params = useParams();
  const router = useRouter();

  // Sahibinden ID'sini API'den al
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Geri
        </Button>
        <h1 className="text-xl font-bold">Sahibinden Onizleme</h1>
        <a
          href={`https://www.sahibinden.com/ilan/${params.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto flex items-center gap-1 text-sm text-[var(--primary)] hover:underline"
        >
          <ExternalLink className="h-4 w-4" /> Yeni Sekmede Ac
        </a>
      </div>
      <div className="rounded-lg border border-[var(--border)] overflow-hidden bg-white" style={{ height: "calc(100vh - 150px)" }}>
        <iframe
          src={`https://www.sahibinden.com/ilan/${params.id}`}
          className="w-full h-full"
          sandbox="allow-same-origin allow-scripts"
          title="Sahibinden Onizleme"
        />
      </div>
    </div>
  );
}
