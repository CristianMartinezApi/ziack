"use server";

import { redirect } from "next/navigation";
import { clearAdminSession, requireAdmin } from "@/lib/admin-auth";

export async function logoutAction() {
  await requireAdmin();
  await clearAdminSession();
  redirect("/admin-login");
}
