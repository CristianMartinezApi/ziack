"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const productInput = z.object({
  name: z.string().trim().min(2).max(100),
  category: z.string().trim().min(2).max(50),
  price: z.coerce.number().positive().max(100000),
  stock: z.coerce.number().int().min(0).max(100000),
  description: z.string().trim().min(10).max(2000),
});

const slugify = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export async function createProduct(formData: FormData) {
  await requireAdmin();
  const parsed = productInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("Confira os campos do produto e tente novamente.");
  const data = parsed.data;
  const categorySlug = slugify(data.category);
  const category = await prisma.category.upsert({ where: { slug: categorySlug }, update: {}, create: { name: data.category, slug: categorySlug } });
  const slug = `${slugify(data.name)}-${Date.now().toString().slice(-5)}`;
  await prisma.product.create({
    data: {
      name: data.name,
      slug,
      description: data.description,
      price: data.price,
      sku: `ZK-${Date.now()}`,
      stock: data.stock,
      active: true,
      categoryId: category.id,
    },
  });
  revalidatePath("/admin/produtos");
  revalidatePath("/");
}

export async function updateProduct(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const parsed = productInput.safeParse(Object.fromEntries([...formData].filter(([key]) => key !== "id")));
  if (!id || !parsed.success) throw new Error("Não foi possível atualizar o produto. Confira os campos.");
  const data = parsed.data;
  const categorySlug = slugify(data.category);
  const category = await prisma.category.upsert({ where: { slug: categorySlug }, update: {}, create: { name: data.category, slug: categorySlug } });
  await prisma.product.update({ where: { id }, data: { name: data.name, description: data.description, price: data.price, stock: data.stock, categoryId: category.id } });
  revalidatePath("/admin/produtos");
  revalidatePath("/");
}

export async function toggleProduct(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Produto inválido.");
  const product = await prisma.product.findUniqueOrThrow({ where: { id }, select: { active: true } });
  await prisma.product.update({ where: { id }, data: { active: !product.active } });
  revalidatePath("/admin/produtos");
  revalidatePath("/");
}

export async function deleteProduct(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Produto inválido.");
  await prisma.product.delete({ where: { id } });
  revalidatePath("/admin/produtos");
  revalidatePath("/");
}
