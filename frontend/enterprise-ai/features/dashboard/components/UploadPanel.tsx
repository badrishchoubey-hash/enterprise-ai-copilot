"use client";

import { useRef, useState } from "react";

import { CheckCircle2, FileUp, UploadCloud, X } from "lucide-react";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { useAppDispatch } from "@/store/hooks";
import { addDocument } from "@/store/documentsSlice";
import Button from "@/components/ui/button/button";
import Input from "@/components/ui/input/input";

const schema = z.object({
  file: z
    .custom<FileList>()
    .refine((files) => files?.length === 1, "Choose a document to upload"),
});

type FormValues = z.infer<typeof schema>;

type UploadPanelProps = { readonly onClose: () => void };
export default function UploadPanel({ onClose }: UploadPanelProps) {
  const dispatch = useAppDispatch();

  const inputRef = useRef<HTMLInputElement>(null);

  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const file = useWatch({ control, name: "file" })?.[0];

  const fileField = register("file");

  const submit = (values: FormValues) => {
    const selected = values.file[0];

    dispatch(
      addDocument({
        name: selected.name.replace(/\.[^/.]+$/, ""),
        type: selected.name.split(".").pop()?.toUpperCase() as
          "PDF" | "DOCX" | "TXT",
        size: `${(selected.size / 1024 / 1024).toFixed(1)} MB`,
      }),
    );

    setDone(true);

    setTimeout(onClose, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#152033]/30 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-[520px] rounded-3xl bg-white p-7 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xl font-bold text-[#1f2a3a]">Upload knowledge</p>

            <p className="mt-1 text-sm text-[#818b9c]">
              Add a source document to your enterprise knowledge base.
            </p>
          </div>

          <Button
            variant="icon"
            onClick={onClose}
            className="rounded-lg p-2 text-[#9ca5b2] hover:bg-[#f5f6fa]"
          >
            <X size={19} />
          </Button>
        </div>

        {done ? (
          <div className="my-14 text-center">
            <CheckCircle2 className="mx-auto text-[#1baf73]" size={52} />

            <p className="mt-4 text-lg font-bold text-[#273244]">
              Upload started
            </p>

            <p className="mt-1 text-sm text-[#8791a0]">
              Your document is being processed.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(submit)} className="mt-7">
            <Button
              variant="secondary"
              type="button"
              onClick={() => inputRef.current?.click()}
              className="group w-full rounded-2xl border-2 border-dashed border-[#d9dce9] bg-[#fbfbfe] px-6 py-10 text-center transition hover:border-[#8e88f0] hover:bg-[#f9f8ff]"
            >
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#eeedff] text-[#5146e5]">
                <UploadCloud size={23} />
              </div>

              <p className="mt-4 text-sm font-bold text-[#465266]">
                {file ? file.name : "Drop your file here, or click to browse"}
              </p>

              <p className="mt-2 text-xs text-[#9aa3b1]">
                PDF, DOCX, or TXT · Maximum file size 25 MB
              </p>
            </Button>

            <Input
              {...fileField}
              ref={(element) => {
                fileField.ref(element);
                inputRef.current = element;
              }}
              type="file"
              accept=".pdf,.docx,.txt"
              className="hidden"
            />

            {errors.file && (
              <p className="mt-2 text-xs font-medium text-red-500">
                {errors.file.message as string}
              </p>
            )}

            <div className="mt-6 flex items-center gap-3 rounded-xl bg-[#f7f8fc] p-3 text-xs text-[#788395]">
              <FileUp size={16} className="text-[#5146e5]" />
              Files are automatically chunked and indexed for secure AI
              retrieval.
            </div>

            <div className="mt-7 flex justify-end gap-3">
              <Button
                variant="ghost"
                type="button"
                onClick={onClose}
                className="rounded-xl px-5 py-2.5 text-sm font-semibold text-[#6d788a] hover:bg-[#f5f6fa]"
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={isSubmitting || !file}
                className="rounded-xl bg-[#5146e5] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#5146e5]/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Upload document
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
