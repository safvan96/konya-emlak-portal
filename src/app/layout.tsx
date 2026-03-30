import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/shared/auth-provider";
import { ToastProvider } from "@/components/ui/toast";
import { KeyboardShortcuts } from "@/components/shared/keyboard-shortcuts";

export const metadata: Metadata = {
  title: "Emlak Portal - Sahibinden Direkt İlanlar",
  description:
    "Sahibinden direkt satılık ve kiralık emlak ilanları portalı",
  manifest: "/manifest.json",
  themeColor: "#2563eb",
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
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
