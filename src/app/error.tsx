"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-bold text-[var(--destructive)]">500</h1>
        <h2 className="text-xl font-semibold">Bir hata oluştu</h2>
        <p className="text-[var(--muted-foreground)] max-w-md">
          Beklenmeyen bir hata meydana geldi. Lütfen tekrar deneyin.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center justify-center rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] px-6 py-2 text-sm font-medium hover:opacity-90 transition"
        >
          Tekrar Dene
        </button>
      </div>
    </div>
  );
}
