import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import WorkspaceClient from "./WorkspaceClient";
export default async function WorkspacePage() {
  if (!(await cookies()).get("nexa_access")) redirect("/signin");
  return <WorkspaceClient />;
}
