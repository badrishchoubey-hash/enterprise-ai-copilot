"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Activity, Clock3, FileText, ThumbsUp, Users } from "lucide-react";
import Button from "@/components/ui/button/button";
import AdminLayout from "./AdminLayout";
import { getAdminAnalytics, getAdminErrorMessage } from "@/services/api/admin";
import type { AdminAnalytics } from "../types";

const periodSchema = z.object({ days: z.enum(["7", "30", "90", "365"]) });
type PeriodValues = z.infer<typeof periodSchema>;

const formatBytes = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

function Breakdown({
  title,
  values,
}: {
  readonly title: string;
  readonly values: Record<string, number>;
}) {
  const rows = Object.entries(values);
  const max = Math.max(1, ...rows.map(([, count]) => count));
  return (
    <section className="rounded-2xl border border-[#e8eaf1] bg-white p-5">
      <h3 className="text-base font-bold text-[#273244]">{title}</h3>
      <div className="mt-5 space-y-4">
        {rows.length ? (
          rows.map(([label, value]) => (
            <div key={label}>
              <div className="mb-1.5 flex justify-between gap-4 text-xs">
                <span className="capitalize text-[#687386]">
                  {label.replaceAll("_", " ")}
                </span>
                <span className="font-bold text-[#354155]">
                  {value.toLocaleString()}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#f0f1f6]">
                <div
                  className="h-full rounded-full bg-[#716be8]"
                  style={{ width: `${Math.max(3, (value / max) * 100)}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-xl bg-[#f8f9fc] p-4 text-sm text-[#8a94a4]">
            No data for this period.
          </p>
        )}
      </div>
    </section>
  );
}

export default function AdminAnalyticsPage() {
  const [days, setDays] = useState(30);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { register, handleSubmit } = useForm<PeriodValues>({
    resolver: zodResolver(periodSchema) as never,
    defaultValues: { days: "30" },
  });

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    void getAdminAnalytics(days)
      .then((result) => {
        if (current) setAnalytics(result);
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
  }, [days]);

  const applyPeriod = (values: PeriodValues) => setDays(Number(values.days));
  const cards = analytics
    ? [
        {
          label: "Active users",
          value: `${analytics.users.active.toLocaleString()} / ${analytics.users.total.toLocaleString()}`,
          detail: "currently active",
          icon: Users,
          tone: "bg-[#fff3e4] text-[#ee8b24]",
        },
        {
          label: "Documents",
          value: analytics.documents.total.toLocaleString(),
          detail: `${formatBytes(analytics.documents.totalFileBytes)} stored`,
          icon: FileText,
          tone: "bg-[#eeedff] text-[#5146e5]",
        },
        {
          label: "Queries",
          value: analytics.usage.totalQueries.toLocaleString(),
          detail: `past ${days} days`,
          icon: Activity,
          tone: "bg-[#e9f3ff] text-[#3979cb]",
        },
        {
          label: "Average response time",
          value: `${analytics.usage.averageLatencyMs.toLocaleString()} ms`,
          detail: `${analytics.usage.averageResultCount} sources per query`,
          icon: Clock3,
          tone: "bg-[#e8f8f1] text-[#1c9b68]",
        },
      ]
    : [];

  return (
    <AdminLayout
      title="Analytics"
      description="Monitor users, knowledge coverage, query performance, and feedback."
    >
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-[#e8eaf1] bg-white p-5">
        <div>
          <h3 className="text-sm font-bold text-[#354155]">Reporting period</h3>
          <p className="mt-1 text-xs text-[#8a94a4]">
            Query and feedback metrics use this period.
          </p>
        </div>
        <form
          onSubmit={handleSubmit(applyPeriod)}
          className="flex items-end gap-2"
        >
          <label className="text-xs font-semibold text-[#596579]">
            Range
            <select
              {...register("days")}
              className="mt-1 h-10 rounded-lg border border-[#e1e5ed] bg-white px-3 text-sm outline-none focus:border-[#716be8]"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last 365 days</option>
            </select>
          </label>
          <Button
            type="submit"
            className="h-10 rounded-lg px-4 text-sm font-semibold"
          >
            Update
          </Button>
        </form>
      </div>

      {error && (
        <p
          role="alert"
          className="mb-5 rounded-xl bg-[#fff0f0] p-4 text-sm text-[#bd4444]"
        >
          {error}
        </p>
      )}
      {loading && <div className="space-y-5" aria-label="Loading analytics"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-32 rounded-2xl shimmer" />)}</div><div className="grid gap-5 xl:grid-cols-2">{[1, 2].map((item) => <div key={item} className="h-52 rounded-2xl shimmer" />)}</div></div>}
      {!loading && analytics && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map(({ label, value, detail, icon: Icon, tone }) => (
              <section
                key={label}
                className="rounded-2xl border border-[#e8eaf1] bg-white p-5"
              >
                <span
                  className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}
                >
                  <Icon size={19} />
                </span>
                <p className="mt-5 text-xs font-medium text-[#7c8798]">
                  {label}
                </p>
                <p className="mt-1 text-2xl font-bold text-[#263244]">
                  {value}
                </p>
                <p className="mt-1 text-[11px] text-[#9aa3b1]">{detail}</p>
              </section>
            ))}
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <Breakdown title="Users by role" values={analytics.users.byRole} />
            <Breakdown
              title="Documents by status"
              values={analytics.documents.byStatus}
            />
          </div>

          <section className="mt-5 rounded-2xl border border-[#e8eaf1] bg-white p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e8f8f1] text-[#1c9b68]">
                <ThumbsUp size={18} />
              </span>
              <div>
                <h3 className="text-base font-bold text-[#273244]">
                  User feedback
                </h3>
                <p className="mt-1 text-xs text-[#8a94a4]">
                  Ratings submitted in the last {days} days
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-[#f8f9fc] p-4">
                <p className="text-xs text-[#8a94a4]">Total ratings</p>
                <p className="mt-1 text-xl font-bold text-[#354155]">
                  {analytics.feedback.total.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl bg-[#f0faf5] p-4">
                <p className="text-xs text-[#5d9077]">Helpful</p>
                <p className="mt-1 text-xl font-bold text-[#17764f]">
                  {analytics.feedback.positive.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl bg-[#fff5f5] p-4">
                <p className="text-xs text-[#b97575]">Not helpful</p>
                <p className="mt-1 text-xl font-bold text-[#bd4444]">
                  {analytics.feedback.negative.toLocaleString()}
                </p>
              </div>
            </div>
            {!analytics.feedback.total && (
              <p className="mt-4 text-xs text-[#8a94a4]">
                No ratings were recorded during this period.
              </p>
            )}
          </section>
        </>
      )}
    </AdminLayout>
  );
}
