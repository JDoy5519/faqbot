// src/lib/nav.ts
export type NavItem = { label: string; href: string; icon?: React.ReactNode };
export const navItems: NavItem[] = [
{ label: "Dashboard", href: "/admin" },
{ label: "Documents", href: "/admin/documents" },
{ label: "Chat", href: "/admin/chat" },
{ label: "Get Started", href: "/admin/get-started" },
{ label: "Billing", href: "/admin/settings/billing" },
{ label: "Settings", href: "/admin/settings" },
];