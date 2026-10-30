import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ProfileClient from "./ProfileClient";

export default async function ProfilePage() {
  if (!(await cookies()).get("nexa_access")) {
    redirect("/signin");
  }

  return <ProfileClient />;
}
