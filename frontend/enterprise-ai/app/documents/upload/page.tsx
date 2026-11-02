import AdminFeatureLoader from "@/features/admin/components/AdminFeatureLoader";
import { requireAdminPage } from "@/lib/auth/requireAdminPage";

export default async function AdminDocumentUploadRoute() {
  await requireAdminPage();
  return <AdminFeatureLoader feature="upload" />;
}
