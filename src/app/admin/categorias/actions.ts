"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const categorySchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().trim().min(2).max(50),
});

const slugify = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export type CategoryActionState = { message: string; success: boolean };

function refreshCategories() {
  revalidatePath("/admin/categorias");
  revalidatePath("/admin/produtos");
  revalidatePath("/");
}

export async function saveCategory(_previousState: CategoryActionState, formData: FormData): Promise<CategoryActionState> {
  await requireAdmin();
  const parsed = categorySchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
  });
  if (!parsed.success) return { message: "Informe um nome de categoria entre 2 e 50 caracteres.", success: false };

  const data = parsed.data;
  const slug = slugify(data.name);
  if (!slug) return { message: "O nome precisa conter letras ou números.", success: false };

  const existing = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
  if (existing && existing.id !== data.id) return { message: "Já existe uma categoria com esse nome.", success: false };

  if (data.id) {
    await prisma.category.update({ where: { id: data.id }, data: { name: data.name, slug } });
  } else {
    await prisma.category.create({ data: { name: data.name, slug } });
  }

  refreshCategories();
  return { message: data.id ? "Categoria atualizada." : "Categoria criada.", success: true };
}

export async function toggleCategory(_previousState: CategoryActionState, formData: FormData): Promise<CategoryActionState> {
  await requireAdmin();
  const id = z.string().cuid().safeParse(formData.get("id"));
  if (!id.success) return { message: "Categoria inválida.", success: false };

  const category = await prisma.category.findUniqueOrThrow({ where: { id: id.data }, select: { active: true } });
  if (category.active) {
    const activeProducts = await prisma.product.count({ where: { categoryId: id.data, active: true } });
    if (activeProducts > 0) {
      return { message: "Mova ou oculte os produtos ativos desta categoria antes de desativá-la.", success: false };
    }
  }

  const result = await prisma.category.updateMany({
    where: { id: id.data, active: category.active },
    data: { active: !category.active },
  });
  if (result.count !== 1) return { message: "A categoria foi alterada em outra sessão. Atualize a página.", success: false };

  refreshCategories();
  return { message: category.active ? "Categoria desativada." : "Categoria reativada.", success: true };
}
