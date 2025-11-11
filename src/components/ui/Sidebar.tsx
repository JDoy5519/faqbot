// src/components/ui/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/lib/nav";

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 border-r bg-white/80 backdrop-blur">
      <div className="p-4 text-xl font-semibold">FAQBot</div>
      <nav className="px-2 pb-4">
        <ul className="space-y-1">
          {navItems.map((n) => {
            const active =
              pathname === n.href || pathname?.startsWith(n.href + "/");
            return (
              <li key={n.href}>
                <Link
                  href={n.href}
                  className={`block rounded-md px-3 py-2 text-sm ${
                    active ? "bg-gray-100 font-medium" : "hover:bg-gray-50"
                  }`}
                >
                  {n.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
