"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn, signUp } from "@/services/api/auth";
import Button from "@/components/ui/button/button";
import Input from "@/components/ui/input/input";
import Dropdown from "@/components/ui/dropdown/dropdown";

const loginSchema = z.object({
  email: z.email("Enter a valid work email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
const signupSchema = loginSchema.extend({
  name: z.string().min(2, "Enter your full name"),
  role: z.enum(["employee", "support_agent", "admin"], {
    error: "Select a role",
  }),
  department: z.string().optional(),
});
type Props = { readonly mode: "signin" | "signup" };
type AuthValues = {
  email: string;
  password: string;
  name?: string;
  role?: "employee" | "support_agent" | "admin";
  department?: string;
};

export default function AuthForm({ mode }: Props) {
  const isSignup = mode === "signup";
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AuthValues>({
    resolver: zodResolver(isSignup ? signupSchema : loginSchema) as never,
  });
  let submitLabel = isSignup ? "Create account" : "Sign in";
  if (isSubmitting) submitLabel = "Connecting...";
  const submit = async (values: AuthValues) => {
    setApiError("");
    try {
      const result = isSignup
        ? await signUp({
            name: values.name ?? "",
            email: values.email,
            password: values.password,
            role: values.role ?? "employee",
            department: values.department,
          })
        : await signIn({ email: values.email, password: values.password });
      router.replace(
        result.user.role === "admin" ? "/dashboard" : "/workspace",
      );
      router.refresh();
    } catch (error) {
      const message = (error as { response?: { data?: { error?: string } } })
        .response?.data?.error;
      setApiError(
        message ?? "We could not complete your request. Please try again.",
      );
    }
  };
  return (
    <main className="flex min-h-screen bg-white">
      <div className="hidden w-[46%] flex-col justify-between bg-[#211b68] p-12 text-white lg:flex">
        <Brand dark />
        <div className="max-w-md">
          <p className="text-sm font-semibold uppercase tracking-[.2em] text-[#aaa5ef]">
            Enterprise knowledge, amplified
          </p>
          <h1 className="mt-5 text-5xl font-bold leading-[1.08] tracking-tight">
            Give every answer a source.
          </h1>
          <p className="mt-6 text-base leading-7 text-[#c3c0ed]">
            A secure AI workspace for the knowledge your teams rely on every
            day.
          </p>
          <div className="mt-10 flex gap-3">
            <span className="rounded-full border border-[#5550a6] px-3 py-1.5 text-xs text-[#c3c0ed]">
              Source citations
            </span>
            <span className="rounded-full border border-[#5550a6] px-3 py-1.5 text-xs text-[#c3c0ed]">
              Private by default
            </span>
          </div>
        </div>
        <p className="text-xs text-[#8580c9]">© 2026 Nexa Intelligence</p>
      </div>
      <div className="flex w-full items-center justify-center px-6 py-12 lg:w-[54%]">
        <div className="w-full max-w-[420px]">
          <div className="mb-10 lg:hidden">
            <Brand />
          </div>
          <p className="text-3xl font-bold tracking-tight text-[#202b3c]">
            {isSignup ? "Create your workspace" : "Welcome back"}
          </p>
          <p className="mt-2 text-sm text-[#8791a1]">
            {isSignup
              ? "Start building a more useful knowledge base."
              : "Sign in to manage your organization’s knowledge."}
          </p>
          {apiError && (
            <p
              role="alert"
              className="mt-5 rounded-xl bg-[#fff0f0] px-4 py-3 text-xs font-semibold text-[#d95656]"
            >
              {apiError}
            </p>
          )}
          <form onSubmit={handleSubmit(submit)} className="mt-8 space-y-4">
            {isSignup && (
              <>
                <Field
                  label="Full name"
                  placeholder="Sarah Chen"
                  error={errors.name?.message as string}
                  {...register("name")}
                />
                <Field
                  label="Department"
                  placeholder="Human Resources (optional)"
                  {...register("department")}
                />
                <div>
                  <label
                    htmlFor="role"
                    className="mb-2 block text-xs font-bold text-[#526074]"
                  >
                    Role
                  </label>
                  <Dropdown
                    id="role"
                    options={[
                      { label: "Employee / User", value: "employee" },
                      { label: "Support agent", value: "support_agent" },
                      { label: "Admin", value: "admin" },
                    ]}
                    error={errors.role?.message as string}
                    {...register("role")}
                  />
                </div>
              </>
            )}
            <Field
              label="Work email"
              type="email"
              placeholder="you@company.com"
              error={errors.email?.message as string}
              {...register("email")}
            />
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-xs font-bold text-[#526074]"
              >
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="h-11 w-full rounded-xl border border-[#e1e5ed] px-4 pr-11 text-sm outline-none focus:border-[#716be8]"
                  {...register("password")}
                />
                <Button
                  variant="icon"
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ba4b2]"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </Button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.password.message as string}
                </p>
              )}
            </div>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#5146e5] text-sm font-bold text-white shadow-lg shadow-[#5146e5]/20 disabled:opacity-60"
            >
              {submitLabel}
              <ArrowRight size={16} />
            </Button>
          </form>
          <p className="mt-8 text-center text-sm text-[#8993a3]">
            {isSignup ? "Already have an account?" : "Don’t have an account?"}{" "}
            <Link
              href={isSignup ? "/signin" : "/signup"}
              className="font-bold text-[#5146e5]"
            >
              {isSignup ? "Sign in" : "Create one"}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
function Brand({ dark = false }: Readonly<{ dark?: boolean }>) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`grid h-9 w-9 place-items-center rounded-xl ${dark ? "bg-[#6258ee]" : "bg-[#5146e5]"} text-white`}
      >
        <ShieldCheck size={19} />
      </div>
      <p
        className={`text-lg font-bold ${dark ? "text-white" : "text-[#1f2a3a]"}`}
      >
        <span>nexa</span>
        <span className={dark ? "text-[#a9a3ff]" : "text-[#5146e5]"}>.</span>
      </p>
    </div>
  );
}
const Field = ({
  label,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
}) => (
  <div>
    <label className="mb-2 block text-xs font-bold text-[#526074]">
      {label}
    </label>
    <Input error={error} {...props} />
  </div>
);
