"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import Header from "@/components/layout/Header/Header";
import Sidebar from "@/components/layout/Sidebar/Sidebar";

export default function EmployeeDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#f7f8fc] text-[#182230]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} isAdmin={false} />
      <main className="min-w-0 flex-1 pt-[86px]">
        <Header isAdmin={false} onOpenSidebar={() => setSidebarOpen(true)} />
        <div className="mx-auto max-w-[1000px] px-5 py-8 sm:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#9ca5b2]">Knowledge workspace</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#263244]">Knowledge search</h1>
          <section className="mt-6 rounded-2xl border border-[#e8eaf1] bg-white p-6 sm:p-8">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#eeedff] text-[#5146e5]"><Search size={20} /></span>
            <h2 className="mt-5 text-base font-bold text-[#273244]">Search is not available yet</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#808b9c]">
              The backend does not currently provide employee knowledge search, AI chat, or conversation APIs. This workspace will show live results when those services are available.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
