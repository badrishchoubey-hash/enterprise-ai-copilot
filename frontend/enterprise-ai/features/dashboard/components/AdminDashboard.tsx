"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import Button from "@/components/ui/button/button";
import Sidebar from "@/components/layout/Sidebar/Sidebar";
import Header from "@/components/layout/Header/Header";
import StatsCards from "./StatsCards";
import DocumentTable from "./DocumentTable";
import UploadPanel from "./UploadPanel";
import DocumentMetadata from "./DocumentMetadata";

export default function AdminDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  return (
    <div className="flex min-h-screen bg-[#f7f8fc] text-[#182230]">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isAdmin={true}
      />
      <main className="min-w-0 flex-1 pt-[86px]">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />
        <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <p className="text-sm text-[#808b9c]">
              Here&apos;s what&apos;s happening across your knowledge base.
            </p>
            <Button
              onClick={() => setUploadOpen(true)}
              className="gap-2 rounded-xl px-4 py-2.5 text-sm font-bold"
            >
              <Plus size={17} />
              Upload document
            </Button>
          </div>
          <StatsCards />
          <DocumentTable />
        </div>
      </main>
      {uploadOpen && <UploadPanel onClose={() => setUploadOpen(false)} />}
      <DocumentMetadata />
    </div>
  );
}
