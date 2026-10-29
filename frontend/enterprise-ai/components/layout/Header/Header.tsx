"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, LogOut, Menu, Search, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/button/button";
import { signOut } from "@/services/api/auth";

type HeaderProps = {
  readonly onOpenSidebar: () => void;
  readonly isAdmin?: boolean;
};

export default function Header({ onOpenSidebar, isAdmin = true }: HeaderProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const handleLogout = async () => {
    setMenuOpen(false);
    try {
      await signOut();
    } finally {
      router.replace("/signin");
      router.refresh();
    }
  };

  return (
<header
  className={`fixed inset-x-0 top-0 z-20 flex h-[86px] items-center justify-between border-b border-[#e8eaf1] bg-white px-5 sm:px-8 ${
    isAdmin ? "lg:left-[248px]" : "lg:left-0"
  }`}
>      <div className="flex items-center gap-3">
        <Button variant="icon" onClick={onOpenSidebar} className="lg:hidden">
          <Menu size={21} />
        </Button>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#9ca5b2]">
            {isAdmin ? "Admin workspace" : "Employee workspace"}
          </p>
          <h1 className="mt-1 text-lg font-bold text-[#263244]">
            {isAdmin ? "Good morning, Sarah" : "Welcome back"}{" "}
            <span className="text-[#f2ab54]">✦</span>
          </h1>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          className="hidden h-9 gap-2 rounded-lg px-3 text-xs sm:inline-flex"
        >
          <Search size={14} />
          Quick search
          <span className="ml-5 rounded bg-[#f1f2f6] px-1.5 py-0.5 text-[10px]">
            ⌘ K
          </span>
        </Button>
        <Button variant="icon" className="relative">
          <Bell size={19} />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#e05261]" />
        </Button>
        <div ref={menuRef} className="relative">
          <Button
            variant="ghost"
            type="button"
            aria-label="Open account menu"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={() => setMenuOpen((open) => !open)}
            className="grid h-9 w-9 rounded-full bg-[#dce8ff] p-0 text-xs font-bold text-[#3560a8]"
          >
            SC
          </Button>
          {menuOpen && (
            <div
              role="menu"
              aria-label="Account menu"
              className="absolute right-0 top-12 z-50 w-52 rounded-2xl border border-[#e7e9f0] bg-white p-2 shadow-xl shadow-[#1b2540]/10"
            >
              <div className="border-b border-[#eef0f4] px-3 py-2">
                <p className="text-xs font-bold text-[#303a4a]">Sarah Chen</p>
                <p className="mt-0.5 text-[10px] text-[#8a94a4]">
                  {isAdmin ? "Administrator" : "Employee"}
                </p>
              </div>
              <Link
                href="/profile"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-[#657085] hover:bg-[#f6f7fb] hover:text-[#5146e5]"
              >
                <UserRound size={16} />
                Profile
              </Link>
              <Button
                variant="ghost"
                role="menuitem"
                onClick={handleLogout}
                className="w-full justify-start gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-[#d95656] hover:bg-[#fff3f3]"
              >
                <LogOut size={16} />
                Logout
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
