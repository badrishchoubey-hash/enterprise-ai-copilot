"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { FileUp, UploadCloud } from "lucide-react";
import Button from "@/components/ui/button/button";
import AdminLayout from "./AdminLayout";
import {
  getAdminErrorMessage,
  uploadAdminDocument,
} from "@/services/api/admin";
import type { DocumentVisibility } from "../types";

const cloudinarySingleUploadLimit = 100 * 1024 * 1024;
const configuredUploadLimit = Number(
  process.env.NEXT_PUBLIC_MAX_FILE_SIZE_BYTES,
);
const maxFileSize =
  Number.isFinite(configuredUploadLimit) && configuredUploadLimit > 0
    ? Math.min(configuredUploadLimit, cloudinarySingleUploadLimit)
    : 10 * 1024 * 1024;
const maxFileSizeLabel = `${Math.floor(maxFileSize / (1024 * 1024))} MB`;
const acceptedExtensions = new Set(["pdf", "doc", "docx", "txt", "md", "csv"]);

const uploadSchema = z
  .object({
    file: z
      .custom<FileList>(
        (value) => typeof FileList !== "undefined" && value instanceof FileList,
        "Choose a document to upload",
      )
      .refine((files) => files.length === 1, "Choose one document")
      .refine((files) => {
        const file = files.item(0);
        const extension = file?.name.split(".").pop()?.toLowerCase() ?? "";
        return acceptedExtensions.has(extension);
      }, "Use a PDF, DOC, DOCX, TXT, MD, or CSV file")
      .refine(
        (files) => (files.item(0)?.size ?? 0) <= maxFileSize,
        `Maximum file size is ${maxFileSizeLabel}`,
      ),
    department: z
      .string()
      .max(120, "Department must be at most 120 characters"),
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

type UploadValues = z.infer<typeof uploadSchema>;

const fieldClass =
  "mt-1 h-11 w-full rounded-xl border border-[#e1e5ed] bg-white px-3 text-sm text-[#364153] outline-none focus:border-[#716be8] focus:ring-2 focus:ring-[#716be8]/10";

export default function AdminUploadPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [uploadedName, setUploadedName] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UploadValues>({
    resolver: zodResolver(uploadSchema) as never,
    defaultValues: { department: "", visibility: "organization" },
  });
  const fileList = useWatch({ control, name: "file" });
  const visibility = useWatch({ control, name: "visibility" });
  const selectedFile = fileList?.item(0);

  const submit = async (values: UploadValues) => {
    const file = values.file.item(0);
    if (!file) return;
    setError("");
    setUploadProgress(0);
    try {
      await uploadAdminDocument({
        file,
        department: values.department.trim() || undefined,
        visibility: values.visibility as DocumentVisibility,
        onProgress: setUploadProgress,
      });
      setUploadedName(file.name);
    } catch (requestError) {
      setUploadProgress(null);
      setError(getAdminErrorMessage(requestError));
    }
  };

  return (
    <AdminLayout
      title="Upload document"
      description="Add a source file and set who can access it in the knowledge base."
    >
      <div className="mx-auto max-w-3xl">
        <section className="rounded-2xl border border-[#e8eaf1] bg-white p-5 sm:p-8">
          {error && (
            <p
              role="alert"
              className="mb-5 rounded-xl bg-[#fff0f0] p-4 text-sm text-[#bd4444]"
            >
              {error}
            </p>
          )}
          {uploadedName ? (
            <div
              role="status"
              className="rounded-xl bg-[#e9f8f1] p-5 text-sm text-[#17764f]"
            >
              <p className="font-bold">{uploadedName} was uploaded.</p>
              <p className="mt-1 text-xs leading-5">
                The original file is stored and text extraction has started.
                Check Manage documents for processing status and retry any
                document that fails.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  onClick={() => router.push("/documents")}
                  className="rounded-lg px-4 py-2 text-sm font-semibold"
                >
                  Manage documents
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setUploadedName("");
                    setError("");
                    reset({ department: "", visibility: "organization" });
                  }}
                  className="rounded-lg px-4 py-2 text-sm"
                >
                  Upload another
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(submit)} className="space-y-6">
              <div>
                <label
                  htmlFor="admin-document-file"
                  className="block text-xs font-bold text-[#526074]"
                >
                  Document file
                </label>
                <div className="mt-2 rounded-2xl border-2 border-dashed border-[#d9dce9] bg-[#fbfbfe] p-6 sm:p-10">
                  <UploadCloud size={30} className="mx-auto text-[#5146e5]" />
                  <p className="mt-3 text-center text-sm font-semibold text-[#354155]">
                    {selectedFile?.name ?? "Choose a file to upload"}
                  </p>
                  <p className="mt-1 text-center text-xs text-[#8a94a4]">
                    PDF, DOC, DOCX, TXT, MD, or CSV · up to {maxFileSizeLabel}
                  </p>
                  <input
                    id="admin-document-file"
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.md,.csv"
                    aria-label="Choose a document file"
                    {...register("file")}
                    className="sr-only"
                  />
                  <div className="mt-5 flex flex-col items-center gap-2">
                    <label
                      htmlFor="admin-document-file"
                      className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg bg-[#eeedff] px-4 text-sm font-semibold text-[#5146e5] hover:bg-[#e3e1ff]"
                    >
                      Choose file
                    </label>
                    <span className="max-w-full truncate text-xs text-[#687386]">
                      {selectedFile?.name ?? "No file selected"}
                    </span>
                  </div>
                  {errors.file?.message && (
                    <p
                      role="alert"
                      className="mt-2 text-center text-xs text-red-500"
                    >
                      {errors.file.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block text-xs font-bold text-[#526074]">
                  Department
                  <input
                    {...register("department")}
                    placeholder="Human Resources"
                    className={fieldClass}
                    aria-invalid={Boolean(errors.department)}
                  />
                  {errors.department && (
                    <span className="mt-1 block text-xs text-red-500">
                      {errors.department.message}
                    </span>
                  )}
                </label>
                <label className="block text-xs font-bold text-[#526074]">
                  Access
                  <select {...register("visibility")} className={fieldClass}>
                    <option value="organization">
                      Everyone in organization
                    </option>
                    <option value="department">Selected department</option>
                    <option value="private">Admins only</option>
                  </select>
                  {visibility === "department" && (
                    <span className="mt-1 block text-[11px] font-normal text-[#8a94a4]">
                      Only members of the department above should access this
                      file.
                    </span>
                  )}
                </label>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-[#f7f8fc] p-4 text-xs leading-5 text-[#788395]">
                <FileUp size={17} className="mt-0.5 shrink-0 text-[#5146e5]" />
                The backend checks your configured file-size limit before
                issuing a short-lived signature. The file then uploads directly
                to Cloudinary without passing through the app server.
              </div>

              {isSubmitting && uploadProgress !== null && (
                <div role="status" aria-live="polite">
                  <div className="mb-1 flex justify-between text-xs text-[#687386]">
                    <span>Uploading to Cloudinary</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label="Document upload progress"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={uploadProgress}
                    className="h-2 overflow-hidden rounded-full bg-[#eceef3]"
                  >
                    <div
                      className="h-full rounded-full bg-[#5146e5] transition-[width]"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-w-40 rounded-xl px-5 py-3 text-sm font-bold"
                >
                  {isSubmitting ? "Uploading…" : "Upload document"}
                </Button>
              </div>
            </form>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
