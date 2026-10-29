"use client";
import dynamic from "next/dynamic";
const AdminDashboard = dynamic(
  () => import("@/features/dashboard/components/AdminDashboard"),
  { ssr: false, loading: () => <div className="min-h-screen bg-[#f7f8fc]" /> },
);
export default function DashboardClient() {
  return <AdminDashboard />;
}
