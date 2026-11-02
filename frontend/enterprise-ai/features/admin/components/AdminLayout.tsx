"use client";

import { useState, type ReactNode } from "react";
import Header from "@/components/layout/Header/Header";
import Sidebar from "@/components/layout/Sidebar/Sidebar";

interface AdminLayoutProps {
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
}

export default function AdminLayout({
  title,
  description,
  children,
}: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#f7f8fc] text-[#182230]">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isAdmin
      />
      <main className="min-w-0 flex-1 pt-[86px]">
        <Header onOpenSidebar={() => setSidebarOpen(true)} isAdmin />
        <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8">
          <div className="mb-7">
            <h2 className="text-2xl font-bold tracking-tight text-[#263244]">
              {title}
            </h2>
            <p className="mt-2 text-sm text-[#808b9c]">{description}</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
