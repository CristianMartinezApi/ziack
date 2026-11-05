import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Heart, ShieldCheck, Truck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatPrice, products } from "@/lib/products";
import type { Product } from "@/lib/products";

type ProductPageProps = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: ProductPageProps) {
  const { slug } = await params;
  let product: Product | undefined;
  try {
    const databaseProduct = await prisma.product.findUnique({ where: { slug }, include: { category: true } });
    if (databaseProduct?.active) {
      product = {
        id: databaseProduct.id,
        slug: databaseProduct.slug,
        name: databaseProduct.name,
        category: databaseProduct.category.name,
        price: Number(databaseProduct.price),
        tone: products.find((item) => item.slug === slug)?.tone ?? "gold",
        description: databaseProduct.description,
      };
    }
  } catch {
    // O catálogo demonstrativo mantém a página disponível sem banco local.
    product = products.find((item) => item.slug === slug);
  }
  return { title: product ? `${product.name} | Ziack` : "Joia | Ziack", description: product?.description };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  let product: Product | undefined;
  try {
    const databaseProduct = await prisma.product.findUnique({ where: { slug }, include: { category: true } });
    if (databaseProduct?.active) {
      product = {
        id: databaseProduct.id,
        slug: databaseProduct.slug,
        name: databaseProduct.name,
        category: databaseProduct.category.name,
        price: Number(databaseProduct.price),
        tone: products.find((item) => item.slug === slug)?.tone ?? "gold",
        description: databaseProduct.description,
      };
    }
  } catch {
    // Usa o catálogo de demonstração quando o banco ainda não está configurado.
    product = products.find((item) => item.slug === slug);
  }
  if (!product) notFound();

  return <main className="product-detail-page"><header className="detail-header"><Link className="back-link" href="/#colecao"><ArrowLeft size={15} /> Voltar à coleção</Link><Link className="wordmark" href="/">ziack<span>.</span></Link><Link className="detail-store-link" href="/admin">Área da loja</Link></header><section className="detail-layout"><div className={`detail-art product-${product.tone}`}><span className="jewel-shape" /><span className="detail-art-label">ZIACK · ESSENCIAIS</span></div><div className="detail-copy"><p className="eyebrow">{product.category} · Coleção essencial</p><h1>{product.name}</h1><p className="detail-price">{formatPrice(product.price)} <span>ou 3x de {formatPrice(product.price / 3)} sem juros</span></p><p className="detail-description">{product.description}</p><div className="detail-variant"><span>Acabamento</span><button className="finish-option"><i /> Ouro 18k</button></div><button className="button button-dark detail-add">Adicionar à sacola <ArrowRight size={16} /></button><button className="detail-favorite"><Heart size={16} /> Adicionar aos favoritos</button><div className="detail-perks"><p><Truck size={16} /> Frete grátis acima de R$ 350</p><p><ShieldCheck size={16} /> Garantia de 1 ano Ziack</p></div><div className="detail-accordion"><details open><summary>Detalhes da peça</summary><p>Produzida com acabamento premium e cuidado artesanal. Para preservar o brilho, evite contato direto com água, perfumes e cosméticos.</p></details><details><summary>Envio e trocas</summary><p>Embalagem presenteável e envio seguro. Você tem até 7 dias após o recebimento para solicitar uma troca ou devolução.</p></details></div></div></section><footer className="detail-footer"><Link className="wordmark" href="/">ziack<span>.</span></Link><span>Joias para ser. Desde sempre.</span></footer></main>;
}
