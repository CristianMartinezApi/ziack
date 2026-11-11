import Link from "next/link";
import { ArrowLeft, Tags } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { CategoryForm, CategoryToggle } from "./category-form";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const categories = await prisma.category.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  return (
    <main className="admin-content manage-page">
      <header className="manage-header">
        <div>
          <Link href="/admin/produtos" className="back-link"><ArrowLeft size={15} /> Produtos</Link>
          <p className="eyebrow">ORGANIZAÇÃO DO CATÁLOGO</p>
          <h1>Categorias <span>{categories.length}</span></h1>
        </div>
        <Link href="/admin/produtos" className="button button-dark">Ver produtos</Link>
      </header>

      <div className="manage-toolbar"><p>Organize as peças da vitrine. Categorias com produtos ativos não podem ser desativadas.</p></div>
      <section className="category-create-panel">
        <h2><Tags size={16} /> Adicionar categoria</h2>
        <CategoryForm />
      </section>

      <section className="category-list">
        {categories.length ? categories.map((category) => (
          <article className="category-row" key={category.id}>
            <div className="category-current">
              <strong>{category.name}</strong>
              <span>{category._count.products} produtos · {category.active ? "Ativa na vitrine" : "Desativada"}</span>
            </div>
            <CategoryForm category={{ id: category.id, name: category.name }} />
            <CategoryToggle id={category.id} active={category.active} />
          </article>
        )) : <div className="no-orders"><Tags size={24} /><p>Nenhuma categoria criada.</p><span>Adicione categorias para organizar o catálogo.</span></div>}
      </section>
      <p className="manage-note">Categorias usadas por produtos continuam no histórico mesmo quando desativadas. Produtos associados devem ser movidos ou ocultados antes de desativar.</p>
    </main>
  );
}
