"use server";

import { compare } from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createAdminSession } from "@/lib/admin-auth";

type LoginState = { error: string };

export async function loginAction(_previousState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Informe seu e-mail e sua senha." };

  const user = await prisma.user.findUnique({ where: { email } });
  const valid = user?.role === "ADMIN" && await compare(password, user.password);
  if (!user || !valid) return { error: "E-mail ou senha inválidos." };

  await createAdminSession({ id: user.id, email: user.email });
  redirect("/admin");
}
