"use client";

import { ArrowRight } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import type { Product } from "@/lib/products";

export function AddToCartButton({ product, className }: { product: Product; className: string }) {
  const { addItem, items } = useCart();
  const atLimit = items.some((item) => item.id === product.id && item.quantity >= Math.min(10, product.stock));
  const unavailable = product.stock === 0;

  return (
    <button className={className} onClick={() => addItem(product)} disabled={unavailable || atLimit}>
      {unavailable ? "Estoque indisponível" : atLimit ? "Limite de estoque atingido" : <>Adicionar à sacola <ArrowRight size={16} /></>}
    </button>
  );
}
