
"use client";

import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar/Sidebar";
import Header from "@/components/layout/Header/Header";

export default function ProfileClient() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Replace with your actual logged-in user's role.
  const isAdmin = true;

  return (
    <div className="flex min-h-screen bg-[#f7f8fc] text-[#182230]">
      {isAdmin && (
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      )}

      <main className="min-w-0 flex-1 pt-[86px]">
        <Header
          isAdmin={isAdmin}
          onOpenSidebar={() => setSidebarOpen(true)}
        />

        <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8">
          <section className="mx-auto max-w-2xl rounded-2xl border border-[#e8eaf1] bg-white p-8">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#9ca5b2]">
              Account
            </p>

            <h1 className="mt-2 text-2xl font-bold text-[#263244]">
              Your profile
            </h1>

            <p className="mt-2 text-sm text-[#808b9c]">
              Manage your Nexa workspace identity and preferences.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-[#f7f8fc] p-4">
                <p className="text-xs text-[#8a94a4]">Name</p>
                <p className="mt-1 text-sm font-semibold text-[#364153]">
                  Sarah Chen
                </p>
              </div>

              <div className="rounded-xl bg-[#f7f8fc] p-4">
                <p className="text-xs text-[#8a94a4]">Role</p>
                <p className="mt-1 text-sm font-semibold text-[#364153]">
                  {isAdmin ? "Administrator" : "Employee"}
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
