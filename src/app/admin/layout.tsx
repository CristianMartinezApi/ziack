import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { AdminSidebar } from "./admin-sidebar";

export default async function ProtectedAdminLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requireAdmin();
  const pendingOrders = await prisma.order.count({ where: { status: "PENDING" } });

  return (
    <div className="admin-shell">
      <AdminSidebar pendingOrders={pendingOrders} adminEmail={admin.email} />
      <div className="admin-main">{children}</div>
    </div>
  );
}
