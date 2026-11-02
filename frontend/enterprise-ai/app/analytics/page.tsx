import AdminFeatureLoader from "@/features/admin/components/AdminFeatureLoader";
import { requireAdminPage } from "@/lib/auth/requireAdminPage";

export default async function AdminAnalyticsRoute() {
  await requireAdminPage();
  return <AdminFeatureLoader feature="analytics" />;
}
