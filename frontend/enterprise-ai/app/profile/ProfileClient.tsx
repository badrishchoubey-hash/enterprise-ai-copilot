
"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/layout/Sidebar/Sidebar";
import Header from "@/components/layout/Header/Header";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchProfile } from "@/store/authSlice";

export default function ProfileClient() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const dispatch = useAppDispatch();
  const { user, status, error } = useAppSelector((state) => state.auth);
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!user && status === "idle") {
      void dispatch(fetchProfile());
    }
  }, [dispatch, status, user]);

  const formatDate = (value?: string) =>
    value ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value)) : "Not available";

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

            {status === "loading" && (
              <p className="mt-8 rounded-xl bg-[#f7f8fc] p-4 text-sm text-[#808b9c]">
                Loading your profile...
              </p>
            )}
            {error && (
              <p role="alert" className="mt-8 rounded-xl bg-[#fff0f0] p-4 text-sm text-[#d95656]">
                {error}
              </p>
            )}
            {user && (
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-[#f7f8fc] p-4">
                <p className="text-xs text-[#8a94a4]">Name</p>
                <p className="mt-1 text-sm font-semibold text-[#364153]">
                  {user.name}
                </p>
              </div>
              <div className="rounded-xl bg-[#f7f8fc] p-4">
                <p className="text-xs text-[#8a94a4]">Role</p>
                <p className="mt-1 text-sm font-semibold text-[#364153]">
                  {user.role === "admin" ? "Administrator" : user.role === "support_agent" ? "Support agent" : "Employee"}
                </p>
              </div>
              <div className="rounded-xl bg-[#f7f8fc] p-4">
                <p className="text-xs text-[#8a94a4]">Email</p>
                <p className="mt-1 break-words text-sm font-semibold text-[#364153]">{user.email}</p>
              </div>
              <div className="rounded-xl bg-[#f7f8fc] p-4">
                <p className="text-xs text-[#8a94a4]">Department</p>
                <p className="mt-1 text-sm font-semibold text-[#364153]">{user.department ?? "Not specified"}</p>
              </div>
              <div className="rounded-xl bg-[#f7f8fc] p-4">
                <p className="text-xs text-[#8a94a4]">Account status</p>
                <p className="mt-1 text-sm font-semibold text-[#364153]">{user.isActive ? "Active" : "Inactive"}</p>
              </div>
              <div className="rounded-xl bg-[#f7f8fc] p-4">
                <p className="text-xs text-[#8a94a4]">Last login</p>
                <p className="mt-1 text-sm font-semibold text-[#364153]">{formatDate(user.lastLoginAt)}</p>
              </div>
              <div className="rounded-xl bg-[#f7f8fc] p-4 sm:col-span-2">
                <p className="text-xs text-[#8a94a4]">Member since</p>
                <p className="mt-1 text-sm font-semibold text-[#364153]">{formatDate(user.createdAt)}</p>
              </div>
            </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
