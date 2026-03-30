"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Building2, Heart, User, LogOut, Settings, Bell } from "lucide-react";
import { ThemeToggle } from "@/components/shared/theme-toggle";

const navItems = [
  { href: "/my-listings", label: "İlanlarım", icon: Building2 },
  { href: "/favorites", label: "Favoriler", icon: Heart },
  { href: "/notifications", label: "Bildirimler", icon: Bell },
  { href: "/preferences", label: "Tercihler", icon: Settings },
  { href: "/profile", label: "Profil", icon: User },
];

export function CustomerNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    fetch("/api/assignments/unread")
      .then((r) => r.ok ? r.json() : { unread: 0 })
      .then((data) => setUnread(data.unread));
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--card)]">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <h1 className="text-xl font-bold text-[var(--primary)]">
          Emlak Portal
        </h1>
        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
                {item.href === "/my-listings" && unread > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
            );
          })}
          <div className="ml-4 flex items-center gap-2 border-l border-[var(--border)] pl-4">
            <span className="text-sm text-[var(--muted-foreground)] hidden sm:inline">
              {session?.user?.name} {session?.user?.surname}
            </span>
            <ThemeToggle />
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-[var(--muted-foreground)] hover:bg-[var(--accent)] transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </nav>
      </div>
    </header>
  );
}
