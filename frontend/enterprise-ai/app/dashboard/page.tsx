import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";
export default async function DashboardPage() {
  if (!(await cookies()).get("nexa_access")) redirect("/signin");
  return <DashboardClient />;
}
