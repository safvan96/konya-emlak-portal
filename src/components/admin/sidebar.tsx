"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Building2,
  Users,
  Link2,
  ScrollText,
  Bot,
  MapPin,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { ThemeToggle } from "@/components/shared/theme-toggle";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/listings", label: "İlanlar", icon: Building2 },
  { href: "/customers", label: "Müşteriler", icon: Users },
  { href: "/assignments", label: "Atamalar", icon: Link2 },
  { href: "/logs", label: "Loglar", icon: ScrollText },
  { href: "/scraper", label: "Scraper", icon: Bot },
  { href: "/cities", label: "Şehirler", icon: MapPin },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile header */}
      <div className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-4 lg:hidden">
        <h1 className="text-lg font-bold text-[var(--primary)]">Emlak Portal</h1>
        <button onClick={() => setOpen(!open)} className="p-2 hover:bg-[var(--accent)] rounded-md">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen w-64 border-r border-[var(--border)] bg-[var(--card)] transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center border-b border-[var(--border)] px-6">
          <h1 className="text-xl font-bold text-[var(--primary)]">Emlak Portal</h1>
        </div>
        <nav className="flex flex-col gap-1 p-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 border-t border-[var(--border)] p-4 space-y-2">
          {session?.user && (
            <div className="px-3 pb-2 border-b border-[var(--border)]">
              <p className="text-sm font-medium truncate">{session.user.name} {session.user.surname}</p>
              <p className="text-xs text-[var(--muted-foreground)] truncate">{session.user.email}</p>
            </div>
          )}
          <div className="flex items-center justify-between px-3">
            <span className="text-xs text-[var(--muted-foreground)]">Tema</span>
            <ThemeToggle />
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Çıkış Yap
          </button>
        </div>
      </aside>
    </>
  );
}
