import { AdminSidebar } from "@/components/admin/sidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <AdminSidebar />
      <main className="pt-14 p-4 lg:pt-0 lg:ml-64 lg:p-6">{children}</main>
    </div>
  );
}
