import AuthForm from "@/features/auth/components/AuthForm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
export default async function SignUpPage() {
  if ((await cookies()).get("nexa_access")) redirect("/dashboard");
  return <AuthForm mode="signup" />;
}
