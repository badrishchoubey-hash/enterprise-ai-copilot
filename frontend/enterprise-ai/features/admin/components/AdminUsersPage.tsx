"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import Button from "@/components/ui/button/button";
import Input from "@/components/ui/input/input";
import AdminLayout from "./AdminLayout";
import {
  createAdminUser,
  deactivateAdminUser,
  getAdminErrorMessage,
  getAdminUsers,
  updateAdminUser,
  type AdminUserFilters,
} from "@/services/api/admin";
import type { AdminUser } from "../types";

const roles = ["employee", "support_agent", "admin"] as const;
const filterSchema = z.object({
  search: z.string(),
  role: z.enum(["all", ...roles]),
  isActive: z.enum(["all", "true", "false"]),
});
const createSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(160),
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters").max(256),
  role: z.enum(roles),
  department: z.string().max(120, "Department is too long"),
});
const editSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(160),
  email: z.email("Enter a valid email"),
  role: z.enum(roles),
  department: z.string().max(120, "Department is too long"),
  isActive: z.boolean(),
});
type FilterValues = z.infer<typeof filterSchema>;
type CreateValues = z.infer<typeof createSchema>;
type EditValues = z.infer<typeof editSchema>;

const inputClass =
  "mt-1 h-10 rounded-lg border border-[#e1e5ed] px-3 text-sm outline-none focus:border-[#716be8] focus:ring-2 focus:ring-[#716be8]/10";
const selectClass =
  "mt-1 h-10 w-full rounded-lg border border-[#e1e5ed] bg-white px-3 text-sm outline-none focus:border-[#716be8]";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [filters, setFilters] = useState<AdminUserFilters>({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<AdminUser | null>(null);

  const filterForm = useForm<FilterValues>({
    resolver: zodResolver(filterSchema) as never,
    defaultValues: { search: "", role: "all", isActive: "all" },
  });
  const createForm = useForm<CreateValues>({
    resolver: zodResolver(createSchema) as never,
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "employee",
      department: "",
    },
  });
  const editForm = useForm<EditValues>({
    resolver: zodResolver(editSchema) as never,
    defaultValues: {
      name: "",
      email: "",
      role: "employee",
      department: "",
      isActive: true,
    },
  });

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    void getAdminUsers({ ...filters, page, limit: 10 })
      .then((result) => {
        if (!current) return;
        setUsers(result.items);
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
    if (!editing) return;
    editForm.reset({
      name: editing.name,
      email: editing.email,
      role: editing.role,
      department: editing.department ?? "",
      isActive: editing.isActive,
    });
  }, [editForm, editing]);

  const applyFilters = (values: FilterValues) => {
    setFilters({
      search: values.search.trim() || undefined,
      role: values.role === "all" ? undefined : values.role,
      isActive:
        values.isActive === "all" ? undefined : values.isActive === "true",
    });
    setPage(1);
  };

  const submitCreate = async (values: CreateValues) => {
    setError("");
    setNotice("");
    try {
      await createAdminUser({
        ...values,
        department: values.department.trim() || undefined,
      });
      createForm.reset();
      setNotice("User account created.");
      setPage(1);
      setReload((count) => count + 1);
    } catch (requestError) {
      setError(getAdminErrorMessage(requestError));
    }
  };

  const submitEdit = async (values: EditValues) => {
    if (!editing) return;
    setError("");
    setNotice("");
    try {
      await updateAdminUser(editing.id, {
        ...values,
        department: values.department.trim() || null,
      });
      setEditing(null);
      setNotice("User account updated.");
      setReload((count) => count + 1);
    } catch (requestError) {
      setError(getAdminErrorMessage(requestError));
    }
  };

  const deactivate = async (user: AdminUser) => {
    if (!window.confirm(`Deactivate ${user.name}’s account?`)) return;
    setError("");
    setNotice("");
    try {
      await deactivateAdminUser(user.id);
      setNotice(`${user.name}’s account was deactivated.`);
      setReload((count) => count + 1);
    } catch (requestError) {
      setError(getAdminErrorMessage(requestError));
    }
  };

  return (
    <AdminLayout
      title="Manage users"
      description="Create accounts, update access roles, and control account status."
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

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="overflow-hidden rounded-2xl border border-[#e8eaf1] bg-white">
          <form
            onSubmit={filterForm.handleSubmit(applyFilters)}
            className="flex flex-wrap items-end gap-3 border-b border-[#eef0f4] p-5"
          >
            <label className="min-w-[190px] flex-1 text-xs font-semibold text-[#596579]">
              Search
              <Input
                {...filterForm.register("search")}
                placeholder="Name, email, department"
                className={inputClass}
              />
            </label>
            <label className="w-full text-xs font-semibold text-[#596579] sm:w-40">
              Role
              <select {...filterForm.register("role")} className={selectClass}>
                <option value="all">All roles</option>
                <option value="employee">Employee</option>
                <option value="support_agent">Support agent</option>
                <option value="admin">Administrator</option>
              </select>
            </label>
            <label className="w-full text-xs font-semibold text-[#596579] sm:w-36">
              Status
              <select
                {...filterForm.register("isActive")}
                className={selectClass}
              >
                <option value="all">All accounts</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </label>
            <Button
              type="submit"
              className="h-10 rounded-lg px-4 text-sm font-semibold"
            >
              Apply filters
            </Button>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[740px] text-left">
              <thead className="bg-[#fbfbfd] text-[10px] font-bold uppercase tracking-[.12em] text-[#9aa3b1]">
                <tr>
                  <th className="px-5 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f1f5]">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-[#fcfcff]">
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-[#354155]">
                        {user.name}
                      </p>
                      <p className="mt-1 text-xs text-[#8a94a4]">
                        {user.email}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-xs font-medium text-[#5e697b]">
                      {user.role === "support_agent"
                        ? "Support agent"
                        : user.role === "admin"
                          ? "Administrator"
                          : "Employee"}
                    </td>
                    <td className="px-4 py-4 text-xs text-[#687386]">
                      {user.department || "—"}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${user.isActive ? "bg-[#e9f8f1] text-[#1a8b60]" : "bg-[#f1f2f5] text-[#788395]"}`}
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="inline-flex gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => setEditing(user)}
                          className="rounded-lg px-3 py-2 text-xs font-semibold"
                        >
                          Edit
                        </Button>
                        {user.isActive && (
                          <Button
                            variant="ghost"
                            onClick={() => void deactivate(user)}
                            className="rounded-lg px-3 py-2 text-xs font-semibold text-[#c34b4b]"
                          >
                            Deactivate
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && users.length === 0 && (
              <p className="p-10 text-center text-sm text-[#8a94a4]">
                No users match these filters.
              </p>
            )}
            {loading && <div className="space-y-4 p-6" aria-label="Loading users">{[1, 2, 3, 4, 5].map((row) => <div key={row} className="h-10 rounded-lg shimmer" />)}</div>}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eef0f4] px-5 py-4 text-xs text-[#8a94a4]">
            <span>
              {total} account{total === 1 ? "" : "s"}
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

        <section className="rounded-2xl border border-[#e8eaf1] bg-white p-5">
          <h3 className="text-base font-bold text-[#273244]">Create account</h3>
          <p className="mt-1 text-xs leading-5 text-[#8a94a4]">
            Set the initial role and department. Users can change their password
            after signing in.
          </p>
          <form
            onSubmit={createForm.handleSubmit(submitCreate)}
            className="mt-5 space-y-3"
          >
            <label className="block text-xs font-semibold text-[#596579]">
              Name
              <Input
                {...createForm.register("name")}
                className={inputClass}
                error={createForm.formState.errors.name?.message}
              />
            </label>
            <label className="block text-xs font-semibold text-[#596579]">
              Email
              <Input
                {...createForm.register("email")}
                type="email"
                className={inputClass}
                error={createForm.formState.errors.email?.message}
              />
            </label>
            <label className="block text-xs font-semibold text-[#596579]">
              Temporary password
              <Input
                {...createForm.register("password")}
                type="password"
                className={inputClass}
                error={createForm.formState.errors.password?.message}
              />
            </label>
            <label className="block text-xs font-semibold text-[#596579]">
              Role
              <select {...createForm.register("role")} className={selectClass}>
                <option value="employee">Employee</option>
                <option value="support_agent">Support agent</option>
                <option value="admin">Administrator</option>
              </select>
            </label>
            <label className="block text-xs font-semibold text-[#596579]">
              Department
              <Input
                {...createForm.register("department")}
                className={inputClass}
                error={createForm.formState.errors.department?.message}
              />
            </label>
            <Button
              type="submit"
              disabled={createForm.formState.isSubmitting}
              className="mt-2 w-full rounded-lg py-2.5 text-sm font-semibold"
            >
              {createForm.formState.isSubmitting
                ? "Creating account…"
                : "Create user"}
            </Button>
          </form>
        </section>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#152033]/35 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-user-title"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h2
              id="edit-user-title"
              className="text-lg font-bold text-[#263244]"
            >
              Edit user
            </h2>
            <form
              onSubmit={editForm.handleSubmit(submitEdit)}
              className="mt-5 grid gap-4 sm:grid-cols-2"
            >
              <label className="text-xs font-semibold text-[#596579]">
                Name
                <Input
                  {...editForm.register("name")}
                  className={inputClass}
                  error={editForm.formState.errors.name?.message}
                />
              </label>
              <label className="text-xs font-semibold text-[#596579]">
                Email
                <Input
                  {...editForm.register("email")}
                  type="email"
                  className={inputClass}
                  error={editForm.formState.errors.email?.message}
                />
              </label>
              <label className="text-xs font-semibold text-[#596579]">
                Role
                <select {...editForm.register("role")} className={selectClass}>
                  <option value="employee">Employee</option>
                  <option value="support_agent">Support agent</option>
                  <option value="admin">Administrator</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-[#596579]">
                Department
                <Input
                  {...editForm.register("department")}
                  className={inputClass}
                  error={editForm.formState.errors.department?.message}
                />
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-[#596579] sm:col-span-2">
                <input
                  type="checkbox"
                  {...editForm.register("isActive")}
                  className="h-4 w-4 accent-[#5146e5]"
                />
                Account is active
              </label>
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button
                  variant="secondary"
                  onClick={() => setEditing(null)}
                  className="rounded-lg px-4 py-2 text-sm"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={editForm.formState.isSubmitting}
                  className="rounded-lg px-4 py-2 text-sm font-semibold"
                >
                  {editForm.formState.isSubmitting ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}
    </AdminLayout>
  );
}
