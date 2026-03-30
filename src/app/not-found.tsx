import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-bold text-[var(--muted-foreground)]">404</h1>
        <h2 className="text-xl font-semibold">Sayfa Bulunamadı</h2>
        <p className="text-[var(--muted-foreground)]">Aradığınız sayfa mevcut değil veya taşınmış olabilir.</p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] px-6 py-2 text-sm font-medium hover:opacity-90 transition"
        >
          Ana Sayfaya Dön
        </Link>
      </div>
    </div>
  );
}
