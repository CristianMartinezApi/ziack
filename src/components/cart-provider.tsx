"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { z } from "zod";
import type { Product } from "@/lib/products";

const cartItemSchema = z.object({
  id: z.string().min(1),
  slug: z.string(),
  name: z.string(),
  category: z.string(),
  price: z.number().nonnegative(),
  stock: z.number().int().nonnegative().optional(),
  imageUrl: z.string().regex(/^\/uploads\/[a-f0-9-]{36}\.(jpg|png|webp)$/).optional().nullable(),
  tone: z.enum(["pearl", "gold", "rose", "onyx"]),
  quantity: z.number().int().min(1).max(10),
});
const cartSchema = z.array(cartItemSchema).max(30);

export type CartItem = z.infer<typeof cartItemSchema>;

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  storageError: string;
  addItem: (product: Product) => boolean;
  setQuantity: (productId: string, quantity: number) => void;
  syncInventory: (products: Array<Pick<Product, "id" | "stock">>) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "ziack-cart";
const CHANGE_EVENT = "ziack-cart-change";
const emptySnapshot = { items: [] as CartItem[], error: "" };
let cachedRaw: string | null | undefined;
let cachedSnapshot = emptySnapshot;

function getCartSnapshot() {
  let stored: string | null;
  try {
    stored = window.localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    if (!(error instanceof DOMException)) throw error;
    cachedRaw = "__unavailable__";
    cachedSnapshot = { items: [], error: "O navegador não permitiu acessar a sacola salva." };
    return cachedSnapshot;
  }
  if (stored === cachedRaw) return cachedSnapshot;
  cachedRaw = stored;

  if (!stored) {
    cachedSnapshot = emptySnapshot;
    return cachedSnapshot;
  }

  try {
    const parsed = cartSchema.safeParse(JSON.parse(stored));
    cachedSnapshot = parsed.success
      ? { items: parsed.data, error: "" }
      : { items: [], error: "Não foi possível recuperar a sacola salva neste navegador." };
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    cachedSnapshot = { items: [], error: "Não foi possível recuperar a sacola salva neste navegador." };
  }
  return cachedSnapshot;
}

function subscribeToCart(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(subscribeToCart, getCartSnapshot, () => emptySnapshot);
  const { items, error: storageError } = snapshot;

  const saveItems = useCallback((nextItems: CartItem[]) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems));
    } catch (error) {
      if (!(error instanceof DOMException)) throw error;
      cachedRaw = "__unavailable__";
      cachedSnapshot = { items: [], error: "O navegador não permitiu salvar as alterações da sacola." };
      window.dispatchEvent(new Event(CHANGE_EVENT));
      return;
    }
    cachedRaw = undefined;
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const addItem = useCallback((product: Product) => {
    if (product.stock <= 0) return false;
    const existing = items.find((item) => item.id === product.id);
    const quantityLimit = Math.min(10, product.stock);
    if (existing && existing.quantity >= quantityLimit) return false;

    const nextItems = existing
      ? items.map((item) => item.id === product.id ? { ...item, stock: product.stock, quantity: item.quantity + 1 } : item)
      : [...items, {
          id: product.id,
          slug: product.slug,
          name: product.name,
          category: product.category,
          price: product.price,
          stock: product.stock,
          imageUrl: product.imageUrl ?? null,
          tone: product.tone,
          quantity: 1,
        }];
    saveItems(nextItems);
    return true;
  }, [items, saveItems]);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity < 1) {
      saveItems(items.filter((item) => item.id !== productId));
      return;
    }
    const item = items.find((cartItem) => cartItem.id === productId);
    if (!item || quantity > Math.min(10, item.stock ?? 10)) return;
    saveItems(items.map((item) => item.id === productId ? { ...item, quantity } : item));
  }, [items, saveItems]);

  const syncInventory = useCallback((products: Array<Pick<Product, "id" | "stock">>) => {
    const stockById = new Map(products.map((product) => [product.id, product.stock]));
    let changed = false;
    const nextItems = items.map((item) => {
      const stock = stockById.get(item.id);
      if (stock === undefined || item.stock === stock) return item;
      changed = true;
      return { ...item, stock };
    });
    if (changed) saveItems(nextItems);
  }, [items, saveItems]);

  const removeItem = useCallback((productId: string) => {
    saveItems(items.filter((item) => item.id !== productId));
  }, [items, saveItems]);

  const clearCart = useCallback(() => saveItems([]), [saveItems]);
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const value = useMemo(() => ({
    items,
    itemCount,
    storageError,
    addItem,
    setQuantity,
    syncInventory,
    removeItem,
    clearCart,
  }), [items, itemCount, storageError, addItem, setQuantity, syncInventory, removeItem, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart precisa ser usado dentro de CartProvider.");
  return context;
}
