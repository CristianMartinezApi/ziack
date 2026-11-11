import { Storefront } from "@/components/storefront";
import { prisma } from "@/lib/prisma";
import { products, type Product } from "@/lib/products";

export const dynamic = "force-dynamic";

export default async function Home() {
  let catalog: Product[] = products;
  let categoryOptions = ["Colares", "Brincos", "Anéis", "Pulseiras"];
  try {
    const [databaseProducts, activeCategories] = await Promise.all([
      prisma.product.findMany({ where: { active: true, category: { active: true } }, include: { category: true }, orderBy: { createdAt: "desc" } }),
      prisma.category.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { name: true } }),
    ]);
    categoryOptions = activeCategories.map(({ name }) => name);
    if (databaseProducts.length || activeCategories.length) {
      catalog = databaseProducts.map((item) => ({
        id: item.id,
        slug: item.slug,
        name: item.name,
        category: item.category.name,
        price: Number(item.price),
        stock: item.stock,
        compareAt: item.compareAt ? Number(item.compareAt) : undefined,
        tone: products.find((sample) => sample.slug === item.slug)?.tone ?? "gold",
        description: item.description,
        imageUrl: item.imageUrl,
      }));
    }
  } catch {
    catalog = products;
    categoryOptions = ["Colares", "Brincos", "Anéis", "Pulseiras"];
  }
  return <Storefront initialProducts={catalog} categoryOptions={categoryOptions} />;
}
