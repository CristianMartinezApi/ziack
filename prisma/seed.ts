import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { DEFAULT_CHECKOUT_NOTICE, DEFAULT_ORDER_POLICY } from "../src/lib/store-settings-defaults";

const prisma = new PrismaClient();
const catalog = [
  { name: "Brinco Aurora", slug: "brinco-aurora", category: "Brincos", price: 289, sku: "ZK-BR-001", description: "Banhado a ouro 18k com pérola de água doce." },
  { name: "Colar Luna", slug: "colar-luna", category: "Colares", price: 420, sku: "ZK-CL-001", description: "Corrente delicada com pingente orgânico." },
  { name: "Anel Solar", slug: "anel-solar", category: "Anéis", price: 349, sku: "ZK-AN-001", description: "Design escultural com acabamento polido." },
  { name: "Pulseira Essência", slug: "pulseira-essencia", category: "Pulseiras", price: 315, sku: "ZK-PL-001", description: "Pulseira ajustável com banho premium de ouro 18k." },
];

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword || adminPassword.length < 12) {
    throw new Error("Configure ADMIN_EMAIL e ADMIN_PASSWORD (mínimo 12 caracteres) no .env antes do seed.");
  }
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { name: "Equipe Ziack", password: await hash(adminPassword, 12), role: "ADMIN" },
    create: { name: "Equipe Ziack", email: adminEmail, password: await hash(adminPassword, 12), role: "ADMIN" },
  });

  for (const item of catalog) {
    const category = await prisma.category.upsert({
      where: { slug: item.category.toLowerCase().replaceAll(" ", "-") },
      update: {},
      create: { name: item.category, slug: item.category.toLowerCase().replaceAll(" ", "-") },
    });
    await prisma.product.upsert({
      where: { slug: item.slug },
      update: { categoryId: category.id, price: item.price },
      create: {
        name: item.name,
        slug: item.slug,
        description: item.description,
        price: item.price,
        sku: item.sku,
        categoryId: category.id,
        stock: 12,
        active: true,
      },
    });
  }
  await prisma.storeSettings.upsert({
    where: { id: "store" },
    update: {},
    create: {
      id: "store",
      storeName: "Ziack",
      checkoutNotice: DEFAULT_CHECKOUT_NOTICE,
      orderPolicy: DEFAULT_ORDER_POLICY,
    },
  });
  console.info("Catálogo Ziack de demonstração criado.");
}

main().finally(async () => prisma.$disconnect());
