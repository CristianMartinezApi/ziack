import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Box, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { LOW_STOCK_THRESHOLD } from "@/lib/inventory";
import { formatPrice } from "@/lib/products";
import Image from "next/image";
import { createProduct, deleteProduct, toggleProduct, updateProduct } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  await requireAdmin();
  const [products, categories] = await Promise.all([
    prisma.product.findMany({ include: { category: true }, orderBy: { createdAt: "desc" } }),
    prisma.category.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const productsMissingShippingData = products.filter((product) =>
    product.weight === null || product.width === null || product.height === null || product.length === null,
  ).length;
  const categoryOptions = (selectedId?: string) => <>
    <option value="">Selecione uma categoria</option>
    {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
    {selectedId && !categories.some((category) => category.id === selectedId) && <option value={selectedId} disabled>{products.find((item) => item.categoryId === selectedId)?.category.name} (desativada)</option>}
  </>;

  return <main className="admin-content manage-page">
    <header className="manage-header"><div><Link href="/admin" className="back-link"><ArrowLeft size={15} /> Visão geral</Link><p className="eyebrow">CATÁLOGO DA LOJA</p><h1>Produtos <span>{products.length}</span></h1></div><Link href="/#colecao" className="button button-dark">Ver loja <ArrowUpRight size={15} /></Link></header>
    <div className="manage-toolbar"><p>Gerencie o catálogo, estoque, imagens e disponibilidade das suas peças.</p><Link className="text-link" href="/admin/categorias">Gerenciar categorias <ArrowUpRight size={14} /></Link></div>
    {productsMissingShippingData > 0 && <p className="manage-note" role="status">{productsMissingShippingData} produto(s) ainda precisam de peso e dimensões para serem incluídos em cotações do Melhor Envio. Abra cada produto e preencha os campos de envio.</p>}
    <section className="new-product-panel"><h2><Plus size={16} /> Adicionar produto</h2>
      {categories.length ? <form action={createProduct} className="product-form">
        <label>Nome<input name="name" required minLength={2} maxLength={100} placeholder="Ex.: Colar Serena" /></label>
        <label>Categoria<select name="categoryId" required defaultValue="">{categoryOptions()}</select></label>
        <label>Preço (R$)<input name="price" type="number" min="0.01" step="0.01" required placeholder="289,00" /></label>
        <label>Estoque<input name="stock" type="number" min="0" step="1" required placeholder="10" /></label>
        <label>Peso embalado (kg)<input name="weight" type="number" min="0.001" max="1000" step="0.001" required placeholder="0.250" /><small>Peso da peça pronta para despacho, incluindo a embalagem.</small></label>
        <label>Largura (cm)<input name="width" type="number" min="1" max="1000" step="1" required placeholder="15" /></label>
        <label>Altura (cm)<input name="height" type="number" min="1" max="1000" step="1" required placeholder="5" /></label>
        <label>Comprimento (cm)<input name="length" type="number" min="1" max="1000" step="1" required placeholder="20" /></label>
        <label className="form-description">Descrição<textarea name="description" minLength={10} maxLength={2000} required placeholder="Conte sobre os detalhes e materiais da peça." /></label>
        <label className="form-image">Imagem do produto <span>(JPEG, PNG ou WebP · até 5 MB)</span><input name="image" type="file" accept="image/jpeg,image/png,image/webp" /></label>
        <button className="button button-dark" type="submit">Salvar produto <Plus size={15} /></button>
      </form> : <div className="no-products"><Box size={23} /><p>Cadastre uma categoria antes de criar produtos.</p><Link href="/admin/categorias">Gerenciar categorias</Link></div>}
    </section>
    <section className="managed-products"><div className="panel-heading"><div><h2>Todos os produtos</h2><p>{products.length} peças cadastradas</p></div></div>
      {products.length ? products.map((product) => <details className="managed-product" key={product.id}>
        <summary><span className="managed-swatch">{product.imageUrl ? <Image src={product.imageUrl} alt="" width={38} height={38} /> : <Box size={17} />}</span><span className="managed-title"><strong>{product.name}</strong><small>{product.category.name} · SKU {product.sku}{product.weight === null || product.width === null || product.height === null || product.length === null ? " · Frete: medidas pendentes" : ""}</small></span><span className={product.stock === 0 ? "managed-stock managed-stock-unavailable" : product.stock <= LOW_STOCK_THRESHOLD ? "managed-stock managed-stock-low" : "managed-stock"}>{product.stock === 0 ? "Estoque indisponível" : product.stock <= LOW_STOCK_THRESHOLD ? `Estoque baixo · ${product.stock}` : `${product.stock} em estoque`}</span><strong className="managed-price">{formatPrice(Number(product.price))}</strong><span className={product.active ? "product-state live" : "product-state"}>{product.active ? "Ativo" : "Oculto"}</span><span className="edit-hint">Editar</span></summary>
        <form action={updateProduct} className="product-form edit-form"><input type="hidden" name="id" value={product.id} />
          <label>Nome<input name="name" defaultValue={product.name} required minLength={2} maxLength={100} /></label>
          <label>Categoria<select name="categoryId" required defaultValue={categories.some((category) => category.id === product.categoryId) ? product.categoryId : ""}>{categoryOptions(product.categoryId)}</select></label>
          <label>Preço (R$)<input name="price" type="number" min="0.01" step="0.01" defaultValue={Number(product.price)} required /></label>
          <label>Estoque<input name="stock" type="number" min="0" step="1" defaultValue={product.stock} required /></label>
          <label>Peso embalado (kg)<input name="weight" type="number" min="0.001" max="1000" step="0.001" defaultValue={product.weight?.toString() ?? ""} required /><small>Peso da peça pronta para despacho, incluindo a embalagem.</small></label>
          <label>Largura (cm)<input name="width" type="number" min="1" max="1000" step="1" defaultValue={product.width ?? ""} required /></label>
          <label>Altura (cm)<input name="height" type="number" min="1" max="1000" step="1" defaultValue={product.height ?? ""} required /></label>
          <label>Comprimento (cm)<input name="length" type="number" min="1" max="1000" step="1" defaultValue={product.length ?? ""} required /></label>
          <label className="form-description">Descrição<textarea name="description" minLength={10} maxLength={2000} defaultValue={product.description} required /></label>
          <label className="form-image">Substituir imagem <span>(opcional · JPEG, PNG ou WebP · até 5 MB)</span><input name="image" type="file" accept="image/jpeg,image/png,image/webp" /></label>
          {product.imageUrl && <div className="product-image-preview"><Image src={product.imageUrl} alt={`Imagem atual de ${product.name}`} width={100} height={100} /><span>Imagem atual</span></div>}
          <button className="button button-dark" type="submit">Salvar alterações</button>
        </form>
        <div className="managed-actions"><form action={toggleProduct}><input type="hidden" name="id" value={product.id} /><button type="submit">{product.active ? "Ocultar da loja" : "Publicar na loja"}</button></form><form action={deleteProduct}><input type="hidden" name="id" value={product.id} /><button className="delete-action" type="submit">Excluir produto</button></form></div>
      </details>) : <div className="no-products"><Box size={23} /><p>Nenhuma peça cadastrada por enquanto.</p><span>Use o formulário acima para adicionar a primeira peça.</span></div>}
    </section><p className="manage-note">Peso e medidas devem corresponder à peça preparada para envio, incluindo sua embalagem. Informe o peso em quilogramas e as dimensões em centímetros. Produtos já cadastrados precisam ter esses dados preenchidos na edição antes de serem usados em cotações do Melhor Envio. As imagens aceitas são JPEG, PNG e WebP, limitadas a 5 MB, e ficam em armazenamento local persistente.</p>
  </main>;
}
