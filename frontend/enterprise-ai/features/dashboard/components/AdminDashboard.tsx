"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, FileText, Users } from "lucide-react";
import AdminLayout from "@/features/admin/components/AdminLayout";
import Shimmer from "@/components/ui/Shimmer";
import {
  getAdminAnalytics,
  getAdminDocuments,
  getAdminErrorMessage,
} from "@/services/api/admin";
import type { AdminAnalytics, AdminDocument } from "@/features/admin/types";

const cards = (data: AdminAnalytics) => [
  { label: "Active users", value: `${data.users.active} / ${data.users.total}`, icon: Users },
  { label: "Documents", value: data.documents.total.toLocaleString(), icon: FileText },
  { label: "Queries · last 30 days", value: data.usage.totalQueries.toLocaleString(), icon: Activity },
];

export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    void Promise.all([getAdminAnalytics(30), getAdminDocuments({ page: 1, limit: 5 })])
      .then(([metrics, latest]) => {
        if (!current) return;
        setAnalytics(metrics);
        setDocuments(latest.items);
      })
      .catch((cause: unknown) => {
        if (current) setError(getAdminErrorMessage(cause));
      })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, []);

  return (
    <AdminLayout title="Dashboard" description="An overview of your organization’s knowledge base and recent documents.">
      {error && <p role="alert" className="mb-5 rounded-xl bg-[#fff0f0] p-4 text-sm text-[#bd4444]">{error}</p>}
      {loading ? (
        <div className="space-y-5" aria-label="Loading dashboard">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-32 rounded-2xl border border-[#e8eaf1] bg-white p-5"><Shimmer /></div>)}</div>
          <div className="h-64 rounded-2xl border border-[#e8eaf1] bg-white p-6"><Shimmer /></div>
        </div>
      ) : analytics && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cards(analytics).map(({ label, value, icon: Icon }) => <section key={label} className="rounded-2xl border border-[#e8eaf1] bg-white p-5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eeedff] text-[#5146e5]"><Icon size={19} /></span><p className="mt-5 text-xs text-[#7c8798]">{label}</p><p className="mt-1 text-2xl font-bold text-[#263244]">{value}</p></section>)}
          </div>
          <section className="mt-6 overflow-hidden rounded-2xl border border-[#e8eaf1] bg-white">
            <div className="flex items-center justify-between border-b border-[#eef0f4] px-6 py-5"><div><h2 className="text-base font-bold text-[#273244]">Recently added documents</h2><p className="mt-1 text-xs text-[#8a94a4]">Latest documents from the backend</p></div><Link href="/documents" className="text-sm font-semibold text-[#5146e5]">Manage documents</Link></div>
            {documents.length ? <ul className="divide-y divide-[#f0f1f5]">{documents.map((doc) => <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"><div><p className="text-sm font-semibold text-[#354155]">{doc.name}</p><p className="mt-1 text-xs text-[#8a94a4]">{doc.type.toUpperCase()} · {doc.department || "No department"}</p></div><span className="rounded-full bg-[#edf3ff] px-2.5 py-1 text-[11px] font-semibold capitalize text-[#4774c7]">{doc.status}</span></li>)}</ul> : <p className="p-8 text-center text-sm text-[#8a94a4]">No documents have been uploaded yet.</p>}
          </section>
        </>
      )}
    </AdminLayout>
  );
}
