"use client";

import dynamic from "next/dynamic";
import Shimmer from "@/components/ui/Shimmer";

const pageLoading = () => (
  <div className="min-h-[50vh] space-y-5 rounded-2xl bg-white p-6" aria-label="Loading page">
    <Shimmer />
    <div className="grid gap-4 sm:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-24 rounded-xl shimmer" />)}</div>
    <div className="h-56 rounded-xl shimmer" />
  </div>
);

const AdminUsersPage = dynamic(() => import("./AdminUsersPage"), {
  ssr: false,
  loading: pageLoading,
});
const AdminDocumentsPage = dynamic(() => import("./AdminDocumentsPage"), {
  ssr: false,
  loading: pageLoading,
});
const AdminUploadPage = dynamic(() => import("./AdminUploadPage"), {
  ssr: false,
  loading: pageLoading,
});
const AdminKnowledgeBasePage = dynamic(
  () => import("./AdminKnowledgeBasePage"),
  { ssr: false, loading: pageLoading },
);
const AdminAnalyticsPage = dynamic(() => import("./AdminAnalyticsPage"), {
  ssr: false,
  loading: pageLoading,
});

export type AdminFeature =
  "users" | "documents" | "upload" | "knowledge-base" | "analytics";

interface AdminFeatureLoaderProps {
  readonly feature: AdminFeature;
}

export default function AdminFeatureLoader({
  feature,
}: AdminFeatureLoaderProps) {
  switch (feature) {
    case "users":
      return <AdminUsersPage />;
    case "documents":
      return <AdminDocumentsPage />;
    case "upload":
      return <AdminUploadPage />;
    case "knowledge-base":
      return <AdminKnowledgeBasePage />;
    case "analytics":
      return <AdminAnalyticsPage />;
  }
}
