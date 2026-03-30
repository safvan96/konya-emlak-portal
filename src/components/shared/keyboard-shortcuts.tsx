"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

const ADMIN_SHORTCUTS: Record<string, string> = {
  "g d": "/dashboard",
  "g l": "/listings",
  "g m": "/customers",
  "g a": "/assignments",
  "g s": "/scraper",
  "g i": "/analytics",
  "g t": "/settings",
  "g c": "/cities",
  "g o": "/logs",
};

const CUSTOMER_SHORTCUTS: Record<string, string> = {
  "g l": "/my-listings",
  "g f": "/favorites",
  "g p": "/profile",
  "g t": "/preferences",
};

export function KeyboardShortcuts() {
  const router = useRouter();
  const { data: session } = useSession();
  let buffer = "";
  let timeout: NodeJS.Timeout;

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Input/textarea icinde devre disi
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      clearTimeout(timeout);
      buffer += e.key.toLowerCase();

      // 2 karakter kombinasyonlari icin 500ms bekle
      timeout = setTimeout(() => { buffer = ""; }, 500);

      const shortcuts = session?.user?.role === "ADMIN" ? ADMIN_SHORTCUTS : CUSTOMER_SHORTCUTS;
      const match = shortcuts[buffer];

      if (match) {
        e.preventDefault();
        router.push(match);
        buffer = "";
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [session, router]);

  return null;
}
