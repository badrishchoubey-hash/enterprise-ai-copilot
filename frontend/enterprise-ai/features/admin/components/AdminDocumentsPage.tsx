"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Download,
  Eye,
  FileText,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import Button from "@/components/ui/button/button";
import Input from "@/components/ui/input/input";
import Modal from "@/components/common/Modal";
import AdminLayout from "./AdminLayout";
import {
  deleteAdminDocument,
  downloadAdminDocument,
  getAdminDocuments,
  getAdminErrorMessage,
  reprocessUnindexedDocument,
  retryAdminDocument,
  updateAdminDocument,
  type AdminDocumentFilters,
} from "@/services/api/admin";
import type {
  AdminDocument,
  AdminDocumentStatus,
  DocumentVisibility,
} from "../types";

const statuses = [
  "uploaded",
  "processing",
  "completed",
  "failed",
  "archived",
] as const;
const filterSchema = z.object({
  search: z.string(),
  status: z.enum(["all", ...statuses]),
  visibility: z.enum(["all", "private", "department", "organization"]),
});
const editSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a document name").max(255),
    department: z.string().max(120, "Department is too long"),
    visibility: z.enum(["private", "department", "organization"]),
  })
  .superRefine((values, context) => {
    if (values.visibility === "department" && !values.department.trim()) {
      context.addIssue({
        code: "custom",
        path: ["department"],
        message: "Enter a department for department-only access",
      });
    }
  });
type FilterValues = z.infer<typeof filterSchema>;
type EditValues = z.infer<typeof editSchema>;

const inputClass =
  "mt-1 h-10 w-full rounded-lg border border-[#e1e5ed] bg-white px-3 text-sm outline-none focus:border-[#716be8]";
const statusTone: Record<AdminDocumentStatus, string> = {
  uploaded: "bg-[#edf3ff] text-[#4774c7]",
  processing: "bg-[#fff5e5] text-[#c77a17]",
  completed: "bg-[#e9f8f1] text-[#1a8b60]",
  failed: "bg-[#fff0f0] text-[#c34b4b]",
  archived: "bg-[#f1f2f5] text-[#788395]",
};

const formatSize = (bytes?: number) => {
  if (bytes === undefined) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(value),
  );

export default function AdminDocumentsPage() {
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [filters, setFilters] = useState<AdminDocumentFilters>({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<AdminDocument | null>(null);
  const [viewing, setViewing] = useState<AdminDocument | null>(null);
  const [deleting, setDeleting] = useState<AdminDocument | null>(null);
  const [reprocessing, setReprocessing] = useState<AdminDocument | null>(null);

  const filterForm = useForm<FilterValues>({
    resolver: zodResolver(filterSchema) as never,
    defaultValues: { search: "", status: "all", visibility: "all" },
  });
  const editForm = useForm<EditValues>({
    resolver: zodResolver(editSchema) as never,
    defaultValues: { name: "", department: "", visibility: "organization" },
  });

  useEffect(() => {
    let current = true;
    void Promise.resolve().then(() => {
      if (!current) return undefined;
      setLoading(true);
      setError("");
      return getAdminDocuments({ ...filters, page, limit: 10 });
    })
      .then((result) => {
        if (!current || !result) return;
        setDocuments(result.items);
        setTotal(result.total);
        setTotalPages(Math.max(1, result.totalPages));
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
  }, [filters, page, reload]);

  useEffect(() => {
    let initialSync = true;
    const updateVisibility = () => {
      const visible = document.visibilityState === "visible";
      setPageVisible(visible);
      if (visible && !initialSync) setReload((count) => count + 1);
      initialSync = false;
    };
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => {
    const processing = documents.filter((document) => document.status === "processing");
    if (!processing.length || loading || !pageVisible) return;
    // Wait for the earliest quota retry, or check active work after 15 seconds.
    const nextCheck = Math.min(...processing.map((document) => {
      const retryAt = Date.parse(document.processingProgress?.retryAt ?? "");
      return Number.isFinite(retryAt) ? Math.max(15_000, retryAt - Date.now() + 1_000) : 15_000;
    }));
    const timeout = window.setTimeout(
      () => setReload((count) => count + 1),
      nextCheck,
    );
    return () => window.clearTimeout(timeout);
  }, [documents, loading, pageVisible]);

  useEffect(() => {
    if (!editing) return;
    editForm.reset({
      name: editing.name,
      department: editing.department ?? "",
      visibility: editing.visibility,
    });
  }, [editForm, editing]);

  const applyFilters = (values: FilterValues) => {
    setFilters({
      search: values.search.trim() || undefined,
      status: values.status === "all" ? undefined : values.status,
      visibility: values.visibility === "all" ? undefined : values.visibility,
    });
    setPage(1);
  };

  const saveDocument = async (values: EditValues) => {
    if (!editing) return;
    setWorkingId(editing.id);
    setError("");
    try {
      await updateAdminDocument(editing.id, {
        name: values.name,
        department: values.department.trim() || null,
        visibility: values.visibility as DocumentVisibility,
      });
      setEditing(null);
      setNotice("Document details updated.");
      setReload((count) => count + 1);
    } catch (requestError) {
      setError(getAdminErrorMessage(requestError));
    } finally {
      setWorkingId("");
    }
  };

  const removeDocument = async () => {
    if (!deleting) return;
    const document = deleting;
    setDeleting(null);
    setWorkingId(document.id);
    setError("");
    setNotice("");
    try {
      await deleteAdminDocument(document.id);
      setNotice(`${document.name} was deleted.`);
      setReload((count) => count + 1);
    } catch (requestError) {
      setError(getAdminErrorMessage(requestError));
    } finally {
      setWorkingId("");
    }
  };

  const downloadDocument = async (document: AdminDocument) => {
    setWorkingId(document.id);
    setError("");
    try {
      const blob = await downloadAdminDocument(document.id);
      if (typeof blob === "string") {
        window.location.assign(blob);
        return;
      }
      const objectUrl = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = document.name;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch (requestError) {
      setError(getAdminErrorMessage(requestError));
    } finally {
      setWorkingId("");
    }
  };

  const retryProcessing = async (document: AdminDocument) => {
    setWorkingId(document.id);
    setError("");
    setNotice("");
    try {
      await retryAdminDocument(document.id);
      setNotice(`Processing restarted for ${document.name}.`);
      setReload((count) => count + 1);
    } catch (requestError) {
      setError(getAdminErrorMessage(requestError));
    } finally {
      setWorkingId("");
    }
  };

  const reprocessDocument = async () => {
    if (!reprocessing) return;
    const document = reprocessing;
    setReprocessing(null);
    setWorkingId(document.id);
    setError("");
    setNotice("");
    try {
      await reprocessUnindexedDocument(document.id);
      setNotice(`Indexing restarted for ${document.name}.`);
      setReload((count) => count + 1);
    } catch (requestError) {
      setError(getAdminErrorMessage(requestError));
    } finally {
      setWorkingId("");
    }
  };

  return (
    <AdminLayout
      title="Manage documents"
      description="Review uploaded source files, update access, download originals, or remove them from the knowledge base."
    >
      {error && (
        <p
          role="alert"
          className="mb-5 rounded-xl bg-[#fff0f0] p-4 text-sm text-[#bd4444]"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="mb-5 rounded-xl bg-[#e9f8f1] p-4 text-sm text-[#17764f]"
        >
          {notice}
        </p>
      )}

      <section className="overflow-hidden rounded-2xl border border-[#e8eaf1] bg-white">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#eef0f4] p-5">
          <Button
            variant="secondary"
            className="rounded-lg px-3 py-2 text-sm"
            disabled={loading}
            onClick={() => setReload((count) => count + 1)}
          >
            Refresh status
          </Button>
          <form
            onSubmit={filterForm.handleSubmit(applyFilters)}
            className="flex flex-1 flex-wrap items-end gap-3"
          >
            <label className="min-w-[190px] flex-1 text-xs font-semibold text-[#596579]">
              Search documents
              <Input
                {...filterForm.register("search")}
                placeholder="Document name"
                className={inputClass}
              />
            </label>
            <label className="w-full text-xs font-semibold text-[#596579] sm:w-40">
              Status
              <select {...filterForm.register("status")} className={inputClass}>
                <option value="all">All status</option>
                <option value="uploaded">Uploaded</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label className="w-full text-xs font-semibold text-[#596579] sm:w-44">
              Access
              <select
                {...filterForm.register("visibility")}
                className={inputClass}
              >
                <option value="all">All access</option>
                <option value="organization">Organization</option>
                <option value="department">Department</option>
                <option value="private">Admins only</option>
              </select>
            </label>
            <Button
              type="submit"
              className="h-10 rounded-lg px-4 text-sm font-semibold"
            >
              Apply
            </Button>
          </form>
          <Link
            href="/documents/upload"
            className="inline-flex h-10 items-center rounded-lg bg-[#5146e5] px-4 text-sm font-semibold text-white hover:bg-[#453bd0]"
          >
            Upload document
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left">
            <thead className="bg-[#fbfbfd] text-[10px] font-bold uppercase tracking-[.12em] text-[#9aa3b1]">
              <tr>
                <th className="px-5 py-3">Document</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Access</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Uploaded</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f1f5]">
              {documents.map((document) => (
                <tr key={document.id} className="hover:bg-[#fcfcff]">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#eeedff] text-[#5146e5]">
                        <FileText size={17} />
                      </span>
                      <div className="min-w-0">
                        <p className="max-w-[300px] truncate text-sm font-semibold text-[#354155]">
                          {document.name}
                        </p>
                        <p className="mt-1 text-[11px] uppercase text-[#9aa3b1]">
                          {document.type}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusTone[document.status]}`}
                    >
                      {document.status === "completed"
                        ? "Completed"
                        : document.status[0]?.toUpperCase() +
                          document.status.slice(1)}
                    </span>
                    {document.status === "failed" && document.errorMessage && (
                      <p className="mt-1 max-w-48 text-[10px] text-[#bd4444]">
                        {document.errorMessage}
                      </p>
                    )}
                    {document.status === "processing" && (
                      <div className="mt-2 max-w-56 text-[11px] text-[#687386]" role="status">
                        {document.processingProgress ? (
                          <>
                            <p>{document.processingProgress.completedChunks} / {document.processingProgress.totalChunks} chunks indexed</p>
                            {document.processingProgress.retryAt && (
                              <p className="mt-1 text-[#bd7b22]">
                                Waiting for provider limit; retry at {new Date(document.processingProgress.retryAt).toLocaleTimeString()}.
                              </p>
                            )}
                          </>
                        ) : "Preparing document…"}
                      </div>
                    )}
                    {document.status === "completed" && (document.totalChunks ?? 0) === 0 && (
                      <p className="mt-1 text-[10px] font-medium text-[#bd7b22]">No indexed chunks</p>
                    )}
                  </td>
                  <td className="px-4 py-4 text-xs text-[#687386]">
                    {document.visibility === "organization"
                      ? "Organization"
                      : document.visibility === "department"
                        ? document.department || "Department"
                        : "Admins only"}
                  </td>
                  <td className="px-4 py-4 text-xs text-[#687386]">
                    {formatSize(document.fileSize)}
                  </td>
                  <td className="px-4 py-4 text-xs text-[#687386]">
                    {formatDate(document.createdAt)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button
                        variant="icon"
                        aria-label={`View metadata for ${document.name}`}
                        onClick={() => setViewing(document)}
                        className="rounded-lg p-2 text-[#687386]"
                      >
                        <Eye size={16} />
                      </Button>
                      <Button
                        variant="icon"
                        aria-label={`Download ${document.name}`}
                        disabled={workingId === document.id}
                        onClick={() => void downloadDocument(document)}
                        className="rounded-lg p-2 text-[#687386]"
                      >
                        <Download size={16} />
                      </Button>
                      {document.status === "failed" && (
                        <Button
                          variant="icon"
                          aria-label={`Retry processing ${document.name}`}
                          title="Retry processing"
                          disabled={workingId === document.id}
                          onClick={() => void retryProcessing(document)}
                          className="rounded-lg p-2 text-[#c77a17]"
                        >
                          <RotateCcw size={16} />
                        </Button>
                      )}
                      {document.status === "completed" && (document.totalChunks ?? 0) === 0 && (
                        <Button
                          variant="icon"
                          aria-label={`Reindex ${document.name}`}
                          title="Reindex document"
                          disabled={workingId === document.id}
                          onClick={() => setReprocessing(document)}
                          className="rounded-lg p-2 text-[#c77a17]"
                        >
                          <RotateCcw size={16} />
                        </Button>
                      )}
                      <Button
                        variant="icon"
                        aria-label={`Edit ${document.name}`}
                        onClick={() => setEditing(document)}
                        className="rounded-lg p-2 text-[#687386]"
                      >
                        <Pencil size={16} />
                      </Button>
                      <Button
                        variant="icon"
                        aria-label={`Delete ${document.name}`}
                        disabled={workingId === document.id}
                        onClick={() => setDeleting(document)}
                        className="rounded-lg p-2 text-[#c34b4b]"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && (
            <div className="space-y-4 p-6" aria-label="Loading documents">
              {[1, 2, 3, 4, 5].map((row) => (
                <div key={row} className="h-10 rounded-lg shimmer" />
              ))}
            </div>
          )}
          {!loading && documents.length === 0 && (
            <div className="p-10 text-center">
              <p className="text-sm font-semibold text-[#526074]">
                No documents found
              </p>
              <p className="mt-1 text-xs text-[#8a94a4]">
                Upload a source file or change your filters.
              </p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eef0f4] px-5 py-4 text-xs text-[#8a94a4]">
          <span>
            {total} document{total === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => current - 1)}
              className="rounded-lg px-3 py-2 text-xs"
            >
              Previous
            </Button>
            <span>
              Page {page} of {totalPages}
            </span>
            <Button
              variant="secondary"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-lg px-3 py-2 text-xs"
            >
              Next
            </Button>
          </div>
        </div>
      </section>

      {editing && (
        <Modal
          isOpen
          title="Document access and metadata"
          onClose={() => setEditing(null)}
        >
          <form
            onSubmit={editForm.handleSubmit(saveDocument)}
            className="mt-5 space-y-4"
          >
            <label className="block text-xs font-semibold text-[#596579]">
              Display name
              <Input
                {...editForm.register("name")}
                className={inputClass}
                error={editForm.formState.errors.name?.message}
              />
            </label>
            <label className="block text-xs font-semibold text-[#596579]">
              Department
              <Input
                {...editForm.register("department")}
                className={inputClass}
                error={editForm.formState.errors.department?.message}
              />
            </label>
            <label className="block text-xs font-semibold text-[#596579]">
              Access
              <select
                {...editForm.register("visibility")}
                className={inputClass}
              >
                <option value="organization">Everyone in organization</option>
                <option value="department">Selected department</option>
                <option value="private">Admins only</option>
              </select>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                onClick={() => setEditing(null)}
                className="rounded-lg px-4 py-2 text-sm"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={workingId === editing.id}
                className="rounded-lg px-4 py-2 text-sm font-semibold"
              >
                Save changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {viewing && (
        <Modal
          isOpen
          title="Document metadata"
          onClose={() => setViewing(null)}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="mt-1 truncate text-sm text-[#687386]">
                {viewing.name}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusTone[viewing.status]}`}
            >
              {viewing.status[0]?.toUpperCase()}
              {viewing.status.slice(1)}
            </span>
          </div>
          {viewing.errorMessage && (
            <p className="mt-4 rounded-lg bg-[#fff0f0] p-3 text-xs text-[#bd4444]">
              {viewing.errorMessage}
            </p>
          )}
          <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
            {[
              ["Type", viewing.type.toUpperCase()],
              ["MIME type", viewing.mimeType || "Unavailable"],
              ["File size", formatSize(viewing.fileSize)],
              ["Pages", viewing.pageCount?.toLocaleString() || "Unavailable"],
              ["Indexed chunks", viewing.totalChunks?.toLocaleString() || "0"],
              ["Processed", viewing.processedAt ? formatDate(viewing.processedAt) : "Not processed"],
              [
                "Access",
                viewing.visibility === "department"
                  ? `Department · ${viewing.department || "Unassigned"}`
                  : viewing.visibility === "organization"
                    ? "Organization"
                    : "Admins only",
              ],
              ["Uploaded by", viewing.uploadedBy],
              ["Uploaded", formatDate(viewing.createdAt)],
              ["Last updated", formatDate(viewing.updatedAt)],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs font-semibold text-[#8a94a4]">
                  {label}
                </dt>
                <dd className="mt-1 break-words text-[#354155]">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 flex justify-end">
            <Button
              variant="secondary"
              onClick={() => setViewing(null)}
              className="rounded-lg px-4 py-2 text-sm"
            >
              Close
            </Button>
          </div>
        </Modal>
      )}

      <Modal
        isOpen={Boolean(reprocessing)}
        title="Reindex document?"
        onClose={() => setReprocessing(null)}
        closeOnBackdrop={workingId !== reprocessing?.id}
      >
        <p className="text-sm leading-6 text-[#687386]">
          Reprocess <span className="font-semibold text-[#354155]">{reprocessing?.name}</span> to extract its text and create searchable chunks. It will be temporarily unavailable to AI search while processing.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            variant="secondary"
            disabled={workingId === reprocessing?.id}
            onClick={() => setReprocessing(null)}
            className="rounded-lg px-4 py-2 text-sm"
          >
            Cancel
          </Button>
          <Button
            disabled={!reprocessing || workingId === reprocessing.id}
            onClick={() => void reprocessDocument()}
            className="rounded-lg px-4 py-2 text-sm font-semibold"
          >
            Reindex document
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(deleting)}
        title="Delete document?"
        onClose={() => setDeleting(null)}
        closeOnBackdrop={workingId !== deleting?.id}
      >
        <p className="text-sm leading-6 text-[#687386]">
          Delete{" "}
          <span className="font-semibold text-[#354155]">{deleting?.name}</span>{" "}
          and its stored file? This action cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            variant="secondary"
            disabled={workingId === deleting?.id}
            onClick={() => setDeleting(null)}
            className="rounded-lg px-4 py-2 text-sm"
          >
            Cancel
          </Button>
          <Button
            disabled={!deleting || workingId === deleting.id}
            onClick={() => void removeDocument()}
            className="rounded-lg bg-[#c34b4b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ae3e3e]"
          >
            {workingId === deleting?.id ? "Deleting…" : "Delete document"}
          </Button>
        </div>
      </Modal>
    </AdminLayout>
  );
}
