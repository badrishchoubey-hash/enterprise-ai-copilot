"use client";

import { useMemo, useState } from "react";

import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  MoreHorizontal,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { retryDocument, selectDocument } from "@/store/documentsSlice";
import Button from "@/components/ui/button/button";
import Input from "@/components/ui/input/input";

import type { DocumentStatus } from "../types";

const statusMap: Record<
  DocumentStatus,
  {
    label: string;
    className: string;
    icon: typeof CheckCircle2;
  }
> = {
  processed: {
    label: "Processed",
    className: "bg-[#e9f8f1] text-[#1a9d69]",
    icon: CheckCircle2,
  },
  processing: {
    label: "Processing",
    className: "bg-[#fff5e5] text-[#c77a17]",
    icon: Clock3,
  },
  failed: {
    label: "Failed",
    className: "bg-[#fff0f0] text-[#d95656]",
    icon: AlertCircle,
  },
  uploaded: {
    label: "Uploaded",
    className: "bg-[#edf3ff] text-[#4774c7]",
    icon: Clock3,
  },
};

export default function DocumentTable() {
  const dispatch = useAppDispatch();

  const documents = useAppSelector((state) => state.documents.items);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const visible = useMemo(
    () =>
      documents.filter(
        (doc) =>
          doc.name.toLowerCase().includes(query.toLowerCase()) &&
          (filter === "all" || doc.status === filter),
      ),
    [documents, query, filter],
  );

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-[#e8eaf1] bg-white shadow-[0_2px_10px_rgba(30,40,70,.02)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#eef0f4] px-6 py-5">
        <div>
          <h2 className="text-base font-bold text-[#273244]">
            Knowledge documents
          </h2>

          <p className="mt-1 text-xs text-[#8a94a4]">
            Manage and monitor your organization&apos;s source material
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ba4b2]"
            />

            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search documents"
              className="h-9 w-44 rounded-lg border border-[#e4e7ee] pl-9 pr-3 text-xs outline-none focus:border-[#8b85ed] sm:w-52"
            />
          </div>

          <label className="flex h-9 items-center gap-2 rounded-lg border border-[#e4e7ee] px-3 text-xs font-semibold text-[#687386]">
            <SlidersHorizontal size={14} />

            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-transparent outline-none"
            >
              <option value="all">All status</option>
              <option value="processed">Processed</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
            </select>
          </label>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[780px] text-left">
          <thead className="bg-[#fbfbfd] text-[10px] font-bold uppercase tracking-[.12em] text-[#a0a8b5]">
            <tr>
              <th className="px-6 py-3 font-bold">Document</th>
              <th className="px-4 py-3 font-bold">Type</th>
              <th className="px-4 py-3 font-bold">Status</th>
              <th className="px-4 py-3 font-bold">Uploaded</th>
              <th className="px-4 py-3 font-bold">Chunks</th>
              <th className="px-6 py-3 text-right font-bold">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#f0f1f5]">
            {visible.map((doc) => {
              const status = statusMap[doc.status];
              const Icon = status.icon;

              return (
                <tr key={doc.id} className="group hover:bg-[#fcfcff]">
                  <td className="px-6 py-4">
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => dispatch(selectDocument(doc.id))}
                      className="flex items-center gap-3 text-left"
                    >
                      <span
                        className={`grid h-9 w-9 place-items-center rounded-lg text-[9px] font-bold ${
                          doc.type === "PDF"
                            ? "bg-[#fff0f0] text-[#e25454]"
                            : doc.type === "DOCX"
                              ? "bg-[#edf3ff] text-[#4775c9]"
                              : "bg-[#f2f3f6] text-[#738094]"
                        }`}
                      >
                        {doc.type}
                      </span>

                      <span>
                        <span className="block text-sm font-semibold text-[#364153] group-hover:text-[#5146e5]">
                          {doc.name}
                        </span>

                        <span className="mt-0.5 block text-[10px] text-[#a0a8b5]">
                          {doc.size} · {doc.visibility}
                        </span>
                      </span>
                    </Button>
                  </td>

                  <td className="px-4 py-4 text-xs font-semibold text-[#788395]">
                    {doc.type}
                  </td>

                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${status.className}`}
                    >
                      <Icon size={12} />
                      {status.label}
                    </span>

                    {doc.error && (
                      <p className="mt-1 max-w-[150px] text-[10px] text-[#d95656]">
                        {doc.error}
                      </p>
                    )}
                  </td>

                  <td className="px-4 py-4 text-xs text-[#7f8998]">
                    {doc.uploadedAt}
                  </td>

                  <td className="px-4 py-4 text-xs font-semibold text-[#637083]">
                    {doc.chunks || "—"}
                  </td>

                  <td className="px-6 py-4 text-right">
                    {doc.status === "failed" ? (
                      <Button
                        type="button"
                        onClick={() => dispatch(retryDocument(doc.id))}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#e6e8ef] px-3 py-1.5 text-[11px] font-bold text-[#5d687a] hover:border-[#5146e5] hover:text-[#5146e5]"
                      >
                        <RefreshCw size={12} />
                        Retry
                      </Button>
                    ) : (
                      <Button
                        variant="icon"
                        className="rounded-lg p-2 text-[#9ba4b2] hover:bg-[#f1f2f7]"
                      >
                        <MoreHorizontal size={17} />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {visible.length === 0 && (
          <div className="p-10 text-center text-sm text-[#8a94a4]">
            No documents match your search.
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-[#eef0f4] px-6 py-4 text-xs text-[#8a94a4]">
        <span>
          Showing {visible.length} of {documents.length} documents
        </span>

        <span className="font-semibold text-[#5146e5]">
          View all documents →
        </span>
      </div>
    </section>
  );
}
