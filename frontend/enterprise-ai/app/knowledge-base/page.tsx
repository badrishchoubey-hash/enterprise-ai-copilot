import AdminFeatureLoader from "@/features/admin/components/AdminFeatureLoader";
import { requireAdminPage } from "@/lib/auth/requireAdminPage";

export default async function AdminKnowledgeBaseRoute() {
  await requireAdminPage();
  return <AdminFeatureLoader feature="knowledge-base" />;
}
