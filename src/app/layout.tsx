import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/shared/auth-provider";
import { ToastProvider } from "@/components/ui/toast";
import { KeyboardShortcuts } from "@/components/shared/keyboard-shortcuts";
import { ServiceWorkerRegister } from "@/components/shared/sw-register";

export const metadata: Metadata = {
  title: "EvSahip - Sahibinden Direkt Konya Emlak İlanları",
  description: "Konya'da sahibinden satılık ve kiralık emlak ilanları. Emlakçı ilanları otomatik filtrelenir, sadece gerçek sahiplerinden ilanlar gösterilir.",
  manifest: "/manifest.json",
  themeColor: "#2563eb",
  keywords: ["emlak", "sahibinden", "satılık", "kiralık", "konya", "daire", "arsa", "villa"],
  openGraph: {
    title: "EvSahip - Sahibinden Direkt Konya Emlak İlanları",
    description: "Konya'da sahibinden satılık ve kiralık emlak ilanları. Emlakçı ilanları otomatik filtrelenir, sadece gerçek sahiplerinden ilanlar gösterilir.",
    type: "website",
    locale: "tr_TR",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>
        <AuthProvider>
          <ToastProvider>
            <KeyboardShortcuts />
            <ServiceWorkerRegister />
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
