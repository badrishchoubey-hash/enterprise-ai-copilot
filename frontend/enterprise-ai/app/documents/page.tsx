import AdminFeatureLoader from "@/features/admin/components/AdminFeatureLoader";
import { requireAdminPage } from "@/lib/auth/requireAdminPage";

export default async function AdminDocumentsRoute() {
  await requireAdminPage();
  return <AdminFeatureLoader feature="documents" />;
}
