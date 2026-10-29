"use client";
import dynamic from "next/dynamic";
const EmployeeDashboard = dynamic(
  () => import("@/features/dashboard/components/EmployeeDashboard"),
  { ssr: false },
);
export default function WorkspaceClient() {
  return <EmployeeDashboard />;
}
