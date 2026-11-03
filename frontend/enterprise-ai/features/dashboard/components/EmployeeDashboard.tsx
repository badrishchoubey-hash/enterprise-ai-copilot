"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot, Search } from "lucide-react";
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
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#263244]">Your knowledge workspace</h1>
          <section className="mt-6 rounded-2xl border border-[#e8eaf1] bg-white p-6 sm:p-8">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#eeedff] text-[#5146e5]"><Bot size={20} /></span>
            <h2 className="mt-5 text-base font-bold text-[#273244]">Ask a question about company knowledge</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#808b9c]">
              Get an answer grounded in documents your account is permitted to access, with citations so you can check the source.
            </p>
            <Link href="/chat" className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-[#5146e5] px-5 text-sm font-semibold text-white transition hover:bg-[#4338ca] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5146e5]">
              Ask AI <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </section>
          <section className="mt-5 flex items-start gap-3 rounded-2xl border border-[#e8eaf1] bg-white p-5">
            <Search size={18} className="mt-0.5 shrink-0 text-[#7e89a0]" aria-hidden="true" />
            <p className="text-sm leading-6 text-[#7d899b]">Your answers are filtered by document visibility and your department. If the available sources don’t support an answer, Nexa AI will tell you.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
