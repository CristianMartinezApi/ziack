import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, Heart, ShieldCheck, Truck } from "lucide-react";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { prisma } from "@/lib/prisma";
import { formatPrice, products } from "@/lib/products";
import { getStoreSettings } from "@/lib/store-settings";
import type { Product } from "@/lib/products";

type ProductPageProps = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: ProductPageProps) {
  const { slug } = await params;
  let product: Product | undefined;
  try {
    const databaseProduct = await prisma.product.findUnique({ where: { slug }, include: { category: true } });
    if (databaseProduct?.active && databaseProduct.category.active) {
      product = {
        id: databaseProduct.id,
        slug: databaseProduct.slug,
        name: databaseProduct.name,
        category: databaseProduct.category.name,
        price: Number(databaseProduct.price),
        stock: databaseProduct.stock,
        tone: products.find((item) => item.slug === slug)?.tone ?? "gold",
        description: databaseProduct.description,
        imageUrl: databaseProduct.imageUrl,
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
    if (databaseProduct?.active && databaseProduct.category.active) {
      product = {
        id: databaseProduct.id,
        slug: databaseProduct.slug,
        name: databaseProduct.name,
        category: databaseProduct.category.name,
        price: Number(databaseProduct.price),
        stock: databaseProduct.stock,
        tone: products.find((item) => item.slug === slug)?.tone ?? "gold",
        description: databaseProduct.description,
        imageUrl: databaseProduct.imageUrl,
      };
    }
  } catch {
    // Usa o catálogo de demonstração quando o banco ainda não está configurado.
    product = products.find((item) => item.slug === slug);
  }
  if (!product) notFound();
  const storeSettings = await getStoreSettings();

  return <main className="product-detail-page"><header className="detail-header"><Link className="back-link" href="/#colecao"><ArrowLeft size={15} /> Voltar à coleção</Link><Link className="wordmark" href="/">ziack<span>.</span></Link><Link className="detail-store-link" href="/admin">Área da loja</Link></header><section className="detail-layout"><div className={`detail-art product-${product.tone}`}>{product.imageUrl ? <Image src={product.imageUrl} alt={product.name} fill sizes="(max-width: 800px) 100vw, 50vw" className="detail-product-image" /> : <span className="jewel-shape" />}{product.stock === 0 && <span className="stock-badge stock-badge-unavailable">Estoque indisponível</span>}<span className="detail-art-label">ZIACK · ESSENCIAIS</span></div><div className="detail-copy"><p className="eyebrow">{product.category} · Coleção essencial</p><h1>{product.name}</h1><p className="detail-price">{formatPrice(product.price)} <span>ou 3x de {formatPrice(product.price / 3)} sem juros</span></p><p className={`detail-stock ${product.stock > 0 ? "product-stock-available" : "product-stock-unavailable"}`} aria-live="polite">{product.stock > 0 ? "Disponível para envio" : "Estoque indisponível no momento"}</p><p className="detail-description">{product.description}</p><div className="detail-variant"><span>Acabamento</span><button className="finish-option"><i /> Ouro 18k</button></div><AddToCartButton product={product} className="button button-dark detail-add" /><button className="detail-favorite"><Heart size={16} /> Adicionar aos favoritos</button><div className="detail-perks"><p><Truck size={16} /> {storeSettings.freeShippingThreshold ? `Frete grátis acima de ${formatPrice(Number(storeSettings.freeShippingThreshold))}` : "Frete calculado no checkout"}</p><p><ShieldCheck size={16} /> Garantia de 1 ano Ziack</p></div><div className="detail-accordion"><details open><summary>Detalhes da peça</summary><p>Produzida com acabamento premium e cuidado artesanal. Para preservar o brilho, evite contato direto com água, perfumes e cosméticos.</p></details><details><summary>Envio e trocas</summary><p>Embalagem presenteável e envio seguro. Você tem até 7 dias após o recebimento para solicitar uma troca ou devolução.</p></details></div></div></section><footer className="detail-footer"><Link className="wordmark" href="/">ziack<span>.</span></Link><span>Joias para ser. Desde sempre.</span></footer></main>;
}
