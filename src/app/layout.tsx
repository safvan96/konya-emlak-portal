import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/shared/auth-provider";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "Emlak Portal - Sahibinden Direkt İlanlar",
  description:
    "Sahibinden direkt satılık ve kiralık emlak ilanları portalı",
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
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
