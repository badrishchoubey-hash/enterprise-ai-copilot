"use client";

import { BookOpen, MessageSquare, Search } from "lucide-react";
import Button from "@/components/ui/button/button";
import Input from "@/components/ui/input/input";
import Header from "@/components/layout/Header/Header";

export default function EmployeeDashboard() {
  return (
    <div className="min-h-screen bg-[#f7f8fc] pt-[86px]">
      <Header isAdmin={false} onOpenSidebar={() => undefined} />
      <main className="mx-auto px-5 py-8 sm:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#9ca5b2]">
          Knowledge workspace
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#263244]">
          How can we help today?
        </h1>
        <p className="mt-2 text-sm text-[#808b9c]">
          Search conversations and trusted source citations from your
          organization&apos;s knowledge base.
        </p>
        <div className="mt-8 flex items-center gap-3 rounded-2xl border border-[#e4e7ee] bg-white p-3 shadow-sm">
          <Search size={18} className="text-[#9ba4b2]" />
          <Input
            aria-label="Search knowledge"
            placeholder="Search policies, manuals, and FAQs"
            className="h-9 min-w-0 flex-1 rounded-lg border-0 bg-transparent px-0 shadow-none focus:ring-0"
          />
          <Button className="rounded-xl px-4 py-2 text-xs font-bold">
            Search
          </Button>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <section className="rounded-2xl border border-[#e8eaf1] bg-white p-6">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#eeedff] text-[#5146e5]">
              <MessageSquare size={20} />
            </div>
            <h2 className="mt-5 text-base font-bold text-[#273244]">
              Your conversations
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#808b9c]">
              Continue a previous question or start a new support conversation
              with grounded answers.
            </p>
            <Button
              variant="secondary"
              className="mt-5 rounded-xl px-4 py-2 text-xs font-bold"
            >
              View conversations
            </Button>
          </section>
          <section className="rounded-2xl border border-[#e8eaf1] bg-white p-6">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#e8f8f1] text-[#1c9b68]">
              <BookOpen size={20} />
            </div>
            <h2 className="mt-5 text-base font-bold text-[#273244]">
              Source citations
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#808b9c]">
              Every answer includes the documents and sections used so you can
              verify the source.
            </p>
            <Button
              variant="secondary"
              className="mt-5 rounded-xl px-4 py-2 text-xs font-bold"
            >
              Browse knowledge
            </Button>
          </section>
        </div>
      </main>
    </div>
  );
}
