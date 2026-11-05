import { Storefront } from "@/components/storefront";
import { prisma } from "@/lib/prisma";
import { products, type Product } from "@/lib/products";

export const dynamic = "force-dynamic";

export default async function Home() {
  let catalog: Product[] = products;
  try {
    const databaseProducts = await prisma.product.findMany({ where: { active: true }, include: { category: true }, orderBy: { createdAt: "desc" } });
    if (databaseProducts.length) {
      catalog = databaseProducts.map((item) => ({
        id: item.id,
        slug: item.slug,
        name: item.name,
        category: item.category.name,
        price: Number(item.price),
        compareAt: item.compareAt ? Number(item.compareAt) : undefined,
        tone: products.find((sample) => sample.slug === item.slug)?.tone ?? "gold",
        description: item.description,
      }));
    }
  } catch {
    catalog = products;
  }
  return <Storefront initialProducts={catalog} />;
}
