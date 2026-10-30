"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Search,
  ShieldCheck,
  Users,
  Upload,
  BarChart3,
  X,
  Bot,
  Quote,
} from "lucide-react";

import Button from "@/components/ui/button/button";

interface SidebarProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly isAdmin?: boolean;
}

const adminLinks = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Upload documents", href: "/documents/upload", icon: Upload },
  { label: "Manage documents", href: "/documents", icon: FileText },
  { label: "Manage users", href: "/users", icon: Users },
  { label: "Knowledge base", href: "/knowledge-base", icon: BookOpen },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
];

const employeeLinks = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Search knowledge", href: "/search", icon: Search },
  { label: "Ask AI", href: "/chat", icon: Bot },
  { label: "Conversations", href: "/conversations", icon: MessageSquare },
  { label: "Source citations", href: "/citations", icon: Quote },
];

export default function Sidebar({
  open,
  onClose,
  isAdmin = true,
}: SidebarProps) {
  const pathname = usePathname();
  const links = isAdmin ? adminLinks : employeeLinks;

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={onClose}
          className="fixed inset-0 z-20 bg-black/30 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-[248px] flex-col border-r border-[#e7e9f0] bg-white transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex h-[86px] items-center justify-between px-7">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#5146e5] text-white">
              <ShieldCheck size={20} />
            </div>

            <div>
              <p className="text-[17px] font-bold tracking-tight text-[#1e293b]">
                nexa<span className="text-[#5146e5]">.</span>
              </p>
              <p className="text-[9px] font-semibold uppercase tracking-[.18em] text-[#9aa2b1]">
                knowledge copilot
              </p>
            </div>
          </div>

          <Button
            variant="icon"
            onClick={onClose}
            className="lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={20} />
          </Button>
        </div>

        {/* Role-based navigation */}
        <div className="px-3 pt-5">
          <p className="px-4 pb-3 text-[10px] font-bold uppercase tracking-[.18em] text-[#a3aab8]">
            Workspace
          </p>

          <nav className="space-y-1">
            {links.map(({ label, href, icon: Icon }) => {
              const isActive =
                pathname === href ||
                (href !== "/dashboard" && pathname.startsWith(`${href}/`));

              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onClose}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-[#f0efff] font-semibold text-[#5146e5]"
                      : "text-[#687386] hover:bg-[#f6f7fb]"
                  }`}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}
