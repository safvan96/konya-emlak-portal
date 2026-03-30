import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/shared/auth-provider";
import { ToastProvider } from "@/components/ui/toast";
import { KeyboardShortcuts } from "@/components/shared/keyboard-shortcuts";
import { ServiceWorkerRegister } from "@/components/shared/sw-register";

export const metadata: Metadata = {
  title: "Emlak Portal - Sahibinden Direkt İlanlar",
  description: "Sahibinden direkt satılık ve kiralık emlak ilanları portalı. Emlakçı ilanlarını otomatik filtreler, sadece gerçek sahiplerinden ilanları gösterir.",
  manifest: "/manifest.json",
  themeColor: "#2563eb",
  keywords: ["emlak", "sahibinden", "satılık", "kiralık", "konya", "daire", "arsa", "villa"],
  openGraph: {
    title: "Emlak Portal - Sahibinden Direkt İlanlar",
    description: "Emlakçı filtrelemeli, sahibinden direkt emlak ilanları platformu",
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
