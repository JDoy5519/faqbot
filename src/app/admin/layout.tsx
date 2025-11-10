// src/app/admin/layout.tsx
import Sidebar from "@/components/ui/Sidebar";
import Topbar from "@/components/ui/Topbar";

export const dynamic = "force-dynamic";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Topbar />
      <div className="mx-auto flex max-w-screen-2xl gap-0 px-6">
        <Sidebar />
        <main className="min-h-[calc(100vh-60px)] flex-1 bg-white p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
