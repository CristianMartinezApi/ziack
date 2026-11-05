import { requireAdmin } from "@/lib/admin-auth";

export default async function ProtectedAdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return children;
}
