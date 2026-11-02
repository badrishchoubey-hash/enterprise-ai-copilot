import { redirect } from "next/navigation";
import { getAccessToken } from "./cookies";
import { backendGetProfile } from "./backend";

export async function requireAdminPage(): Promise<void> {
  const accessToken = await getAccessToken();
  if (!accessToken) redirect("/signin");

  let role: string;
  try {
    const profile = await backendGetProfile(accessToken);
    role = profile.data.role;
  } catch {
    redirect("/signin");
  }

  if (role !== "admin") redirect("/workspace");
}
