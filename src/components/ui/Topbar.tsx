// src/components/ui/Topbar.tsx
"use client";

export default function Topbar() {
  return (
    <header className="sticky top-0 z-20 border-b bg-white/70 backdrop-blur">
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-6 py-3">
        <div className="text-sm text-gray-600">Unified admin</div>
        <div className="flex items-center gap-3 text-sm text-gray-600">
          Logged in
        </div>
      </div>
    </header>
  );
}
