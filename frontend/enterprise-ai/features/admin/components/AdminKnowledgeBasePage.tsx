"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Database, FileText, Layers3 } from "lucide-react";
import AdminLayout from "./AdminLayout";
import {
  getAdminDocuments,
  getAdminErrorMessage,
  getKnowledgeBaseSummary,
} from "@/services/api/admin";
import type { AdminDocument, KnowledgeBaseSummary } from "../types";

const formatBytes = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

export default function AdminKnowledgeBasePage() {
  const [summary, setSummary] = useState<KnowledgeBaseSummary | null>(null);
  const [recentDocuments, setRecentDocuments] = useState<AdminDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    setLoading(true);
    void Promise.all([
      getKnowledgeBaseSummary(),
      getAdminDocuments({ page: 1, limit: 5 }),
    ])
      .then(([knowledge, documents]) => {
        if (!current) return;
        setSummary(knowledge);
        setRecentDocuments(documents.items);
      })
      .catch((requestError: unknown) => {
        if (current) setError(getAdminErrorMessage(requestError));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, []);

  const cards = summary
    ? [
        {
          label: "Documents",
          value: summary.totalDocuments.toLocaleString(),
          icon: FileText,
          tone: "bg-[#eeedff] text-[#5146e5]",
        },
        {
          label: "Knowledge chunks",
          value: summary.totalChunks.toLocaleString(),
          icon: Layers3,
          tone: "bg-[#e8f8f1] text-[#1c9b68]",
        },
        {
          label: "Stored files",
          value: formatBytes(summary.totalFileBytes),
          icon: Database,
          tone: "bg-[#e9f3ff] text-[#3979cb]",
        },
      ]
    : [];

  return (
    <AdminLayout
      title="Knowledge base"
      description="Review source coverage, document states, and access departments."
    >
      {error && (
        <p
          role="alert"
          className="mb-5 rounded-xl bg-[#fff0f0] p-4 text-sm text-[#bd4444]"
        >
          {error}
        </p>
      )}
      {loading && <div className="space-y-5" aria-label="Loading knowledge base"><div className="grid gap-4 sm:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-28 rounded-2xl shimmer" />)}</div><div className="grid gap-5 xl:grid-cols-2">{[1, 2].map((item) => <div key={item} className="h-56 rounded-2xl shimmer" />)}</div></div>}
      {!loading && summary && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map(({ label, value, icon: Icon, tone }) => (
              <section
                key={label}
                className="rounded-2xl border border-[#e8eaf1] bg-white p-5"
              >
                <span
                  className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}
                >
                  <Icon size={19} />
                </span>
                <p className="mt-5 text-xs font-medium text-[#7c8798]">
                  {label}
                </p>
                <p className="mt-1 text-2xl font-bold text-[#263244]">
                  {value}
                </p>
              </section>
            ))}
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <section className="rounded-2xl border border-[#e8eaf1] bg-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-[#273244]">
                    Document status
                  </h3>
                  <p className="mt-1 text-xs text-[#8a94a4]">
                    Current count by API status
                  </p>
                </div>
                <Link
                  href="/documents"
                  className="text-xs font-semibold text-[#5146e5]"
                >
                  Manage documents <ArrowRight className="inline" size={13} />
                </Link>
              </div>
              <div className="mt-5 space-y-3">
                {Object.entries(summary.documentsByStatus).length ? (
                  Object.entries(summary.documentsByStatus).map(
                    ([status, count]) => (
                      <div
                        key={status}
                        className="flex items-center justify-between rounded-xl bg-[#f8f9fc] px-4 py-3"
                      >
                        <span className="text-sm capitalize text-[#526074]">
                          {status}
                        </span>
                        <span className="text-sm font-bold text-[#354155]">
                          {count.toLocaleString()}
                        </span>
                      </div>
                    ),
                  )
                ) : (
                  <p className="rounded-xl bg-[#f8f9fc] p-4 text-sm text-[#8a94a4]">
                    No documents have been uploaded yet.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-[#e8eaf1] bg-white p-5">
              <h3 className="text-base font-bold text-[#273244]">
                Departments and access
              </h3>
              <p className="mt-1 text-xs text-[#8a94a4]">
                Departments currently represented in document metadata
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {summary.departments.length ? (
                  summary.departments.map((department) => (
                    <span
                      key={department}
                      className="rounded-full bg-[#f0efff] px-3 py-1.5 text-xs font-semibold text-[#5146e5]"
                    >
                      {department}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-[#8a94a4]">
                    No departments assigned yet.
                  </p>
                )}
              </div>
              <div className="mt-6 border-t border-[#eef0f4] pt-4">
                <p className="text-xs font-bold uppercase tracking-wide text-[#8a94a4]">
                  Access scopes
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {summary.supportedVisibility.map((scope) => (
                    <span
                      key={scope}
                      className="rounded-full border border-[#e8eaf1] px-3 py-1.5 text-xs capitalize text-[#687386]"
                    >
                      {scope}
                    </span>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <section className="mt-5 overflow-hidden rounded-2xl border border-[#e8eaf1] bg-white">
            <div className="flex items-center justify-between border-b border-[#eef0f4] px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-[#273244]">
                  Recently added
                </h3>
                <p className="mt-1 text-xs text-[#8a94a4]">
                  Latest source files in the knowledge base
                </p>
              </div>
              <Link
                href="/documents/upload"
                className="rounded-lg bg-[#5146e5] px-3 py-2 text-xs font-semibold text-white hover:bg-[#453bd0]"
              >
                Upload
              </Link>
            </div>
            <ul className="divide-y divide-[#f0f1f5]">
              {recentDocuments.map((document) => (
                <li
                  key={document.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-[#354155]">
                      {document.name}
                    </p>
                    <p className="mt-1 text-xs text-[#8a94a4]">
                      {document.type.toUpperCase()} ·{" "}
                      {document.department || "No department"}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#edf3ff] px-2.5 py-1 text-[11px] font-semibold capitalize text-[#4774c7]">
                    {document.status}
                  </span>
                </li>
              ))}
              {!recentDocuments.length && (
                <li className="px-5 py-8 text-center text-sm text-[#8a94a4]">
                  No sources have been added yet.
                </li>
              )}
            </ul>
          </section>

          {!summary.processingAvailable && (
            <p className="mt-5 rounded-xl border border-[#f2dfbe] bg-[#fffaf1] p-4 text-xs leading-5 text-[#86612b]">
              Files are stored and managed here. Extraction, chunking, and
              indexing are not enabled yet, so uploaded files remain in the
              Uploaded state.
            </p>
          )}
        </>
      )}
    </AdminLayout>
  );
}
