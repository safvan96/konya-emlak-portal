"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { Building2, Shield, Users, Search, Heart, Map } from "lucide-react";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (session) {
      router.push(session.user.role === "ADMIN" ? "/dashboard" : "/home");
    }
  }, [session, status, router]);

  // Giriş yapılmışsa redirect beklerken loading göster
  if (status === "loading" || session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-lg">Yükleniyor...</div>
      </div>
    );
  }

  // Landing page - giriş yapmamış kullanıcılar için
  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="border-b border-[var(--border)]">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-4">
          <h1 className="text-2xl font-bold text-[var(--primary)]">EvSahip</h1>
          <Link
            href="/login"
            className="rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-2 text-sm font-medium hover:opacity-90 transition"
          >
            Giriş Yap
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-20 text-center">
        <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
          Sahibinden Direkt <br />
          <span className="text-[var(--primary)]">Konya Emlak İlanları</span>
        </h2>
        <p className="text-lg text-[var(--muted-foreground)] max-w-2xl mx-auto mb-8">
          Emlakçı ve danışman ilanlarını otomatik filtreleyen, sadece gerçek sahiplerinden satılan
          ilanları size sunan akıllı emlak platformu.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] px-8 py-3 text-base font-medium hover:opacity-90 transition"
        >
          Hemen Başlayın
        </Link>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-8 md:grid-cols-3">
          <FeatureCard
            icon={Search}
            title="Otomatik Tarama"
            description="Sahibinden.com ilanları periyodik olarak taranır ve yeni ilanlar anında sisteme eklenir."
          />
          <FeatureCard
            icon={Shield}
            title="Emlakçı Filtresi"
            description="Gelişmiş algoritma ile emlakçı ve danışman ilanları otomatik tespit edilip filtrelenir."
          />
          <FeatureCard
            icon={Users}
            title="Kişisel İlan Atama"
            description="Her müşteriye özel ilan ataması yapılır. Sadece size seçilen ilanları görürsünüz."
          />
          <FeatureCard
            icon={Heart}
            title="Favori Sistemi"
            description="Beğendiğiniz ilanları favorilere ekleyin, daha sonra kolayca erişin."
          />
          <FeatureCard
            icon={Building2}
            title="Detaylı Bilgi"
            description="Fotoğraf galerisi, oda sayısı, metrekare, bina yaşı ve tüm detaylar tek sayfada."
          />
          <FeatureCard
            icon={Map}
            title="İlçe Haritası"
            description="Konya ilçelerini harita üzerinde görün, ortalama fiyatları tek bakışta karşılaştırın."
          />
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[var(--secondary)] py-16">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <h3 className="text-2xl font-bold mb-4">Gerçek Sahiplerinden İlanlar</h3>
          <p className="text-[var(--muted-foreground)] mb-6">
            Emlakçı komisyonu olmadan, direkt sahibinden alım yapmanın en kolay yolu.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] px-6 py-3 text-sm font-medium hover:opacity-90 transition"
          >
            Giriş Yapın
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] py-8">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-[var(--muted-foreground)]">
          EvSahip &copy; {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6 space-y-3">
      <div className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-[var(--primary)]/10">
        <Icon className="h-5 w-5 text-[var(--primary)]" />
      </div>
      <h4 className="font-semibold">{title}</h4>
      <p className="text-sm text-[var(--muted-foreground)]">{description}</p>
    </div>
  );
}
