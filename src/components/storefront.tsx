"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowDown, ArrowRight, ArrowUpRight, Check, ChevronDown, Heart, Menu, Minus, Plus, Search, ShoppingBag, Sparkles, Trash2, X } from "lucide-react";
import { categories, formatPrice, products as demoProducts, type Product } from "@/lib/products";
import { useCart } from "@/components/cart-provider";

export function Storefront({ initialProducts = demoProducts, categoryOptions = categories.slice(1) }: { initialProducts?: Product[]; categoryOptions?: string[] }) {
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [query, setQuery] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const { items, itemCount, storageError, addItem, setQuantity, syncInventory, removeItem, clearCart } = useCart();
  useEffect(() => {
    syncInventory(initialProducts);
  }, [initialProducts, syncInventory]);
  const filteredProducts = useMemo(() => initialProducts.filter((product) => {
    const matchesCategory = activeCategory === "Todos" || product.category === activeCategory;
    return matchesCategory && product.name.toLowerCase().includes(query.toLowerCase());
  }), [activeCategory, initialProducts, query]);

  function addToCart(product: Product) {
    if (!addItem(product)) {
      setNotice(product.stock === 0 ? `${product.name} está sem estoque no momento` : "Limite de estoque disponível atingido");
      window.setTimeout(() => setNotice(""), 2400);
      return;
    }
    setNotice(`${product.name} foi adicionada à sua sacola`);
    window.setTimeout(() => setNotice(""), 2400);
  }

  return (
    <main>
      <div className="announcement"><Sparkles size={13} /> Joias para celebrar cada capítulo da sua história <span>·</span> <strong>ZIACK</strong></div>
      <header className="site-header">
        <button className="icon-button mobile-menu" aria-label={menuOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
        <nav className={menuOpen ? "main-nav mobile-nav-open" : "main-nav"}><a href="#colecao" onClick={() => setMenuOpen(false)}>Coleção</a><a href="#sobre" onClick={() => setMenuOpen(false)}>Nossa essência</a><a href="#favoritos" onClick={() => setMenuOpen(false)}>Mais amados</a></nav>
        <Link className="wordmark" href="/">ziack<span>.</span></Link>
        <div className="header-actions">
          <button className="icon-button search-trigger" aria-label="Buscar" onClick={() => document.getElementById("product-search")?.focus()}><Search size={20} /></button>
          <Link className="admin-link" href="/admin">Área da loja</Link>
          <button className="icon-button bag-button" aria-label={`Abrir sacola com ${itemCount} ${itemCount === 1 ? "item" : "itens"}`} onClick={() => setCartOpen(true)}><ShoppingBag size={20} /><span className="bag-count">{itemCount}</span></button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow"><span /> A beleza de ser você</p>
          <h1>Um brilho que<br /><em>é só seu.</em></h1>
          <p className="hero-description">Joias para guardar histórias, celebrar encontros e revelar a beleza que sempre esteve aí.</p>
          <a className="button button-dark" href="#colecao">Descubra a coleção <ArrowRight size={16} /></a>
          <div className="hero-note"><span className="note-line" /> Feito para durar. Feito para você.</div>
        </div>
        <div className="hero-art" aria-label="Composição abstrata em tons dourados e creme">
          <div className="art-sun" /><div className="art-ring ring-one" /><div className="art-ring ring-two" />
          <div className="art-pearl" /><div className="art-shadow" />
          <div className="hero-caption"><span>01 / 04</span><span>ESSENCIAL, SEMPRE.</span></div>
          <div className="vertical-label">COLEÇÃO ATEMPORAL — 2026</div>
        </div>
        <div className="hero-index">01<br /><span>—</span><br />04</div>
      </section>

      <div className="benefits-strip"><div><span>01</span> Materiais selecionados</div><div><span>02</span> Feito com intenção</div><div><span>03</span> Presente em cada detalhe</div><div className="strip-arrow"><ArrowDown size={16} /></div></div>

      <section className="collection section-wrap" id="colecao">
        <div className="section-heading"><div><p className="eyebrow">A curadoria Ziack</p><h2>Peças para <em>sentir.</em></h2></div><p>Pequenos detalhes. Grandes significados.<br />Encontre a sua próxima peça favorita.</p></div>
        <div className="collection-toolbar">
          <div className="category-tabs">{["Todos", ...categoryOptions].map((category) => <button key={category} className={activeCategory === category ? "category-tab active" : "category-tab"} onClick={() => setActiveCategory(category)}>{category}</button>)}</div>
          <label className="search-box"><Search size={15} /><input id="product-search" placeholder="Buscar joias" value={query} onChange={(event) => setQuery(event.target.value)} /><ChevronDown size={14} /></label>
        </div>
        <div className="product-grid" id="favoritos">
          {filteredProducts.map((product) => <article className={product.stock === 0 ? "product-card product-card-unavailable" : "product-card"} key={product.id}>
            <Link href={`/produto/${product.slug}`} className={`product-art product-${product.tone}`} aria-label={`Ver ${product.name}`}>
              <span className="product-tag">{product.tag ?? "Ziack essencial"}</span><button className="favorite-button" aria-label="Adicionar aos favoritos" onClick={(event) => { event.preventDefault(); setNotice("Peça salva nos seus favoritos"); window.setTimeout(() => setNotice(""), 2000); }}><Heart size={17} /></button>
              {product.stock === 0 && <span className="stock-badge stock-badge-unavailable">Estoque indisponível</span>}
              {product.imageUrl ? <Image className="catalog-product-image" src={product.imageUrl} alt={product.name} fill sizes="(max-width: 700px) 90vw, (max-width: 1100px) 45vw, 25vw" /> : <span className="jewel-shape" />}<span className="product-quick">Ver peça <ArrowUpRight size={14} /></span>
            </Link>
            <div className="product-info"><div><Link href={`/produto/${product.slug}`} className="product-name">{product.name}</Link><p>{product.category} · Banhado a ouro</p><p className={product.stock > 0 ? "product-stock-available" : "product-stock-unavailable"}>{product.stock > 0 ? "Disponível" : "Estoque indisponível"}</p></div><span className="product-price">{formatPrice(product.price)}</span></div>
            {product.compareAt && <p className="compare-price">De {formatPrice(product.compareAt)} <span>· em até 3x de {formatPrice(product.price / 3)}</span></p>}
            <button className="add-button" onClick={() => addToCart(product)} disabled={product.stock === 0 || items.some((item) => item.id === product.id && item.quantity >= Math.min(10, product.stock))}>{product.stock === 0 ? "Indisponível para compra" : items.some((item) => item.id === product.id && item.quantity >= Math.min(10, product.stock)) ? "Limite de estoque atingido" : <>Adicionar à sacola <ArrowRight size={15} /></>}</button>
          </article>)}
          {filteredProducts.length === 0 && <p className="empty-results">Nenhuma joia encontrada. Tente outra busca.</p>}
        </div>
        <div className="collection-footer"><span>Mostrando {filteredProducts.length} de {initialProducts.length} peças</span><a href="#colecao">Ver toda a coleção <ArrowRight size={15} /></a></div>
      </section>

      <section className="story-section" id="sobre"><div className="story-art"><div className="story-orbit" /><div className="story-object" /><span>ZIACK · 2026</span></div><div className="story-copy"><p className="eyebrow">Feita de momentos</p><h2>Mais do que joias.<br /><em>Parte de você.</em></h2><p>Acreditamos que o que vestimos pode nos lembrar de quem somos. Criamos peças com propósito, feitas para acompanhar a sua história — sem pressa, sem regras, do seu jeito.</p><a className="text-link" href="#colecao">Conheça a Ziack <ArrowUpRight size={16} /></a></div></section>

      <section className="newsletter"><p className="eyebrow">Uma carta, de vez em quando</p><h2>Um pouco de beleza<br />na sua caixa de entrada.</h2><form onSubmit={(event) => { event.preventDefault(); setNotice("Você entrou para a lista Ziack. Até breve!"); window.setTimeout(() => setNotice(""), 2500); }}><input type="email" placeholder="Seu melhor e-mail" required aria-label="Seu e-mail" /><button aria-label="Inscrever-se"><ArrowRight size={18} /></button></form><small>Novidades, histórias e um presente especial na primeira compra.</small></section>

      <footer className="site-footer"><Link className="wordmark" href="/">ziack<span>.</span></Link><p>Joias para ser. Desde sempre.</p><div><a href="#colecao">Coleção</a><a href="#sobre">Nossa essência</a><Link href="/admin">Área da loja</Link></div><span className="copyright">© 2026 Ziack. Feito com intenção.</span></footer>

      {notice && <div className="toast"><Check size={17} />{notice}<button onClick={() => setNotice("")} aria-label="Fechar"><X size={15} /></button></div>}
      {cartOpen && <div className="drawer-backdrop" onClick={() => setCartOpen(false)}><aside className="cart-drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-heading"><h2>Sua sacola <span>({itemCount})</span></h2><button className="icon-button" onClick={() => setCartOpen(false)} aria-label="Fechar sacola"><X size={20} /></button></div>{storageError && <div className="cart-storage-error" role="alert"><p>{storageError}</p><button onClick={clearCart}>Limpar a sacola salva</button></div>}{items.length ? <><div className="cart-items">{items.map((item) => <article className="cart-item" key={item.id}><div className={`cart-item-art product-${item.tone}`}>{item.imageUrl ? <Image src={item.imageUrl} alt="" fill sizes="58px" /> : <span className="jewel-shape" />}</div><div className="cart-item-copy"><strong>{item.name}</strong><span>{formatPrice(item.price)}</span><span className={item.stock === 0 ? "product-stock-unavailable" : "product-stock-available"}>{item.stock === 0 ? "Estoque indisponível" : item.stock === undefined ? "Disponibilidade a confirmar" : "Disponível"}</span><div className="cart-quantity"><button aria-label={`Diminuir quantidade de ${item.name}`} onClick={() => setQuantity(item.id, item.quantity - 1)}><Minus size={13} /></button><span>{item.quantity}</span><button aria-label={`Aumentar quantidade de ${item.name}`} onClick={() => setQuantity(item.id, item.quantity + 1)} disabled={item.quantity >= Math.min(10, item.stock ?? 10)}><Plus size={13} /></button></div></div><button className="cart-remove" aria-label={`Remover ${item.name}`} onClick={() => removeItem(item.id)}><Trash2 size={15} /></button></article>)}</div><div className="cart-summary"><span>Subtotal</span><strong>{formatPrice(items.reduce((total, item) => total + item.price * item.quantity, 0))}</strong><small>Frete a confirmar no checkout.</small>{items.some((item) => item.stock === 0 || item.stock !== undefined && item.quantity > item.stock) ? <p className="cart-unavailable-note">Ajuste ou remova os itens sem estoque para continuar.</p> : <Link className="button button-dark drawer-cta" href="/checkout">Ir para o checkout <ArrowRight size={16} /></Link>}</div></> : <div className="cart-empty"><ShoppingBag size={30} /><p>Sua sacola ainda está vazia.</p><span>Escolha uma peça para chamar de sua.</span></div>}<button className="cart-continue" onClick={() => setCartOpen(false)}>Continuar explorando</button></aside></div>}
    </main>
  );
}
