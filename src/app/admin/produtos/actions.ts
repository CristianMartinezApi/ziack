"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { saveProductImage } from "@/lib/product-images";

const productInput = z.object({
  name: z.string().trim().min(2).max(100),
  categoryId: z.string().cuid(),
  price: z.coerce.number().positive().max(100000),
  stock: z.coerce.number().int().min(0).max(100000),
  weight: z.coerce.number().positive().max(1000),
  width: z.coerce.number().int().positive().max(1000),
  height: z.coerce.number().int().positive().max(1000),
  length: z.coerce.number().int().positive().max(1000),
  description: z.string().trim().min(10).max(2000),
});

const slugify = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function getOptionalImage(formData: FormData) {
  const value = formData.get("image");
  if (value === null || !(value instanceof File) || value.size === 0) return null;
  return value;
}

export async function createProduct(formData: FormData) {
  await requireAdmin();
  const parsed = productInput.safeParse({
    name: formData.get("name"),
    categoryId: formData.get("categoryId"),
    price: formData.get("price"),
    stock: formData.get("stock"),
    weight: formData.get("weight"),
    width: formData.get("width"),
    height: formData.get("height"),
    length: formData.get("length"),
    description: formData.get("description"),
  });
  if (!parsed.success) throw new Error("Confira os campos do produto e tente novamente.");
  const data = parsed.data;
  const category = await prisma.category.findFirst({ where: { id: data.categoryId, active: true } });
  if (!category) throw new Error("Selecione uma categoria ativa.");
  const image = getOptionalImage(formData);
  const imageUrl = image ? await saveProductImage(image) : null;
  const slug = `${slugify(data.name)}-${Date.now().toString().slice(-5)}`;
  await prisma.product.create({
    data: {
      name: data.name,
      slug,
      description: data.description,
      price: data.price,
      sku: `ZK-${Date.now()}`,
      stock: data.stock,
      weight: data.weight,
      width: data.width,
      height: data.height,
      length: data.length,
      active: true,
      categoryId: category.id,
      imageUrl,
    },
  });
  revalidatePath("/admin/produtos");
  revalidatePath("/");
}

export async function updateProduct(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const parsed = productInput.safeParse({
    name: formData.get("name"),
    categoryId: formData.get("categoryId"),
    price: formData.get("price"),
    stock: formData.get("stock"),
    weight: formData.get("weight"),
    width: formData.get("width"),
    height: formData.get("height"),
    length: formData.get("length"),
    description: formData.get("description"),
  });
  if (!id || !parsed.success) throw new Error("Não foi possível atualizar o produto. Confira os campos.");
  const data = parsed.data;
  const category = await prisma.category.findFirst({ where: { id: data.categoryId, active: true } });
  if (!category) throw new Error("Selecione uma categoria ativa.");
  const product = await prisma.product.findUniqueOrThrow({ where: { id }, select: { imageUrl: true } });
  const image = getOptionalImage(formData);
  const imageUrl = image ? await saveProductImage(image) : product.imageUrl;
  await prisma.product.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      price: data.price,
      stock: data.stock,
      weight: data.weight,
      width: data.width,
      height: data.height,
      length: data.length,
      categoryId: category.id,
      imageUrl,
    },
  });
  revalidatePath("/admin/produtos");
  revalidatePath("/");
}

export async function toggleProduct(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Produto inválido.");
  const product = await prisma.product.findUniqueOrThrow({ where: { id }, select: { active: true, category: { select: { active: true } } } });
  if (!product.active && !product.category.active) {
    throw new Error("Reative a categoria ou escolha uma categoria ativa antes de publicar este produto.");
  }
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
