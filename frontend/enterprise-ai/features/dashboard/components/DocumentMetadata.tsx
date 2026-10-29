"use client";

import { FileText, X } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectDocument } from "@/store/documentsSlice";
import Button from "@/components/ui/button/button";

export default function DocumentMetadata() {
  const dispatch = useAppDispatch();

  const selectedId = useAppSelector((state) => state.documents.selectedId);

  const doc = useAppSelector((state) =>
    state.documents.items.find((item) => item.id === selectedId),
  );

  if (!doc) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[#152033]/20">
      <button
        type="button"
        aria-label="Close document details"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={() => dispatch(selectDocument(null))}
      />
      <dialog
        open
        aria-modal="true"
        aria-labelledby="document-details-title"
        className="h-full w-full max-w-[390px] overflow-y-auto bg-white p-7 shadow-2xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <p
              id="document-details-title"
              className="text-lg font-bold text-[#273244]"
            >
              Document details
            </p>

            <p className="mt-1 text-xs text-[#8993a3]">
              Metadata and processing information
            </p>
          </div>

          <Button
            variant="icon"
            onClick={() => dispatch(selectDocument(null))}
            className="rounded-lg p-2 text-[#9ca5b2] hover:bg-[#f5f6fa]"
          >
            <X size={18} />
          </Button>
        </div>

        <div className="mt-8 flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#fff0f0] text-xs font-bold text-[#e25454]">
            <FileText size={24} />
          </span>

          <div>
            <p className="text-sm font-bold text-[#364153]">{doc.name}</p>

            <p className="mt-1 text-xs text-[#8a94a4]">
              {doc.type} · {doc.size}
            </p>
          </div>
        </div>

        <div className="mt-8 space-y-5">
          {[
            ["Status", doc.status],
            ["Uploaded by", doc.uploadedBy],
            ["Uploaded", doc.uploadedAt],
            ["Last updated", doc.updatedAt],
            ["Visibility", doc.visibility],
            ["Knowledge chunks", doc.chunks || "Pending processing"],
            ["Document ID", doc.id],
          ].map(([label, value]) => (
            <div
              key={label}
              className="flex justify-between gap-5 border-b border-[#f0f1f5] pb-4"
            >
              <span className="text-xs text-[#8b95a4]">{label}</span>

              <span className="text-right text-xs font-semibold capitalize text-[#465266]">
                {value}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl bg-[#f6f7fb] p-4">
          <p className="text-xs font-bold text-[#465266]">Indexing pipeline</p>

          <div className="mt-4 space-y-3 text-xs">
            <p className="flex items-center gap-2 text-[#1b9e68]">
              ✓ File uploaded
            </p>

            <p
              className={`flex items-center gap-2 ${
                doc.status === "processing" || doc.status === "uploaded"
                  ? "text-[#c77a17]"
                  : "text-[#1b9e68]"
              }`}
            >
              ◷ Text extraction and chunking
            </p>

            <p className="flex items-center gap-2 text-[#a0a8b5]">
              ○ Embeddings and vector index
            </p>
          </div>
        </div>
      </dialog>
    </div>
  );
}
