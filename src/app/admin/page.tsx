import Link from "next/link";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Box, CircleDollarSign, ClipboardList, PackagePlus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { LOW_STOCK_THRESHOLD } from "@/lib/inventory";
import { formatPrice } from "@/lib/products";

const demoChart = [[42, "Seg"], [68, "Ter"], [51, "Qua"], [83, "Qui"], [61, "Sex"], [96, "Sáb"], [74, "Dom"]] as const;
const demoBestSellers = [["Brinco Aurora", "18 vendidos", "#f0e2ce"], ["Colar Luna", "12 vendidos", "#e8d9bf"], ["Anel Solar", "8 vendidos", "#eadbd6"]] as const;
const statusLabels = {
  PENDING: "Pendente",
  PAID: "Pagamento recebido",
  PREPARING: "Em separação",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
} as const;

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [orderCount, pendingCount, activeProductCount, lowStockCount, lowStockProducts, confirmedOrders, orders] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.product.count({ where: { active: true, category: { active: true } } }),
    prisma.product.count({
      where: { active: true, stock: { lte: LOW_STOCK_THRESHOLD }, category: { active: true } },
    }),
    prisma.product.findMany({
      where: { active: true, stock: { lte: LOW_STOCK_THRESHOLD }, category: { active: true } },
      select: { id: true, name: true, sku: true, stock: true, category: { select: { name: true } } },
      orderBy: [{ stock: "asc" }, { name: "asc" }],
      take: 6,
    }),
    prisma.order.aggregate({
      where: { status: { in: ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] } },
      _count: { _all: true },
      _sum: { subtotal: true, discount: true },
    }),
    prisma.order.findMany({
      select: { id: true, number: true, customerName: true, createdAt: true, status: true, subtotal: true },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
  ]);
  const confirmedSubtotal = Number(confirmedOrders._sum.subtotal ?? 0) - Number(confirmedOrders._sum.discount ?? 0);
  const averageConfirmedSubtotal = confirmedOrders._count._all
    ? confirmedSubtotal / confirmedOrders._count._all
    : null;
  const today = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date()).toUpperCase();

  return (
      <section className="admin-content" id="visao">
        <header className="admin-topbar">
          <div><p className="eyebrow">{today}</p><h1>Bom dia, equipe <span>✳</span></h1></div>
          <div className="admin-top-actions"><Link className="button button-dark" href="/#colecao"><PackagePlus size={16} /> Ver loja</Link></div>
        </header>

        <div className="admin-intro"><div><h2>Visão geral</h2><p>Acompanhe o que está acontecendo na sua loja.</p></div><button className="period-select">Últimos 7 dias <ArrowDownRight size={15} /></button></div>
        <div className="stats-grid">
          <article className="stat-card"><span>Subtotal de pedidos pagos</span><CircleDollarSign size={17} /><strong>{formatPrice(confirmedSubtotal)}</strong><small className="stat-neutral">Marcados manualmente; sem gateway</small></article>
          <article className="stat-card"><span>Pedidos recebidos</span><ClipboardList size={17} /><strong>{orderCount}</strong><small className="stat-neutral">{pendingCount} aguardando confirmação</small></article>
          <article className="stat-card"><span>Ticket médio confirmado</span><CircleDollarSign size={17} /><strong>{averageConfirmedSubtotal === null ? "—" : formatPrice(averageConfirmedSubtotal)}</strong><small className="stat-neutral">{confirmedOrders._count._all} pedido(s) marcado(s) como pago(s)</small></article>
          <article className="stat-card"><span>Produtos ativos</span><Box size={17} /><strong>{activeProductCount}</strong><small className="stat-neutral">No catálogo</small></article>
          <article className={lowStockCount > 0 ? "stat-card stat-card-alert" : "stat-card"}><span>Estoque baixo</span><AlertTriangle size={17} /><strong>{lowStockCount}</strong><small className={lowStockCount > 0 ? "stat-warning" : "stat-neutral"}>{lowStockCount > 0 ? `Até ${LOW_STOCK_THRESHOLD} unidades` : "Nenhuma reposição urgente"}</small></article>
        </div>

        <div className="admin-panels">
          <section className="sales-panel">
            <div className="panel-heading"><div><h3>Vendas ao longo do tempo</h3><p>Prévia demonstrativa</p></div></div>
            <div className="chart"><div className="chart-grid"><span>R$ 4 mil</span><span>R$ 3 mil</span><span>R$ 2 mil</span><span>R$ 1 mil</span></div><div className="chart-bars">{demoChart.map(([height, day]) => <div className="chart-column" key={day}><span className="chart-bar" style={{ height: `${height}%` }} /><small>{day}</small></div>)}</div></div>
          </section>
          <section className="top-products">
            <div className="panel-heading"><div><h3>Mais vendidos</h3><p>Dados demonstrativos</p></div><Link href="/admin/produtos">Ver todos <ArrowUpRight size={14} /></Link></div>
            {demoBestSellers.map(([name, count, color]) => <div className="top-product" key={name}><span className="mini-product" style={{ backgroundColor: color }}><span /></span><strong>{name}<small>{count}</small></strong><ArrowUpRight size={14} /></div>)}
          </section>
        </div>

        <section className="stock-alert-panel" aria-labelledby="stock-alert-title">
          <div className="panel-heading">
            <div><h3 id="stock-alert-title">Atenção ao estoque</h3><p>Produtos ativos com até {LOW_STOCK_THRESHOLD} unidades, incluindo itens sem estoque.</p></div>
            <Link href="/admin/produtos">Gerenciar produtos <ArrowUpRight size={14} /></Link>
          </div>
          {lowStockProducts.length ? <div className="stock-alert-list">
            {lowStockProducts.map((product) => (
              <article className="stock-alert-row" key={product.id}>
                <div><strong>{product.name}</strong><small>{product.category.name} · SKU {product.sku}</small></div>
                <span className={product.stock === 0 ? "stock-alert-quantity out-of-stock" : "stock-alert-quantity"}>{product.stock === 0 ? "Sem estoque" : `${product.stock} ${product.stock === 1 ? "unidade" : "unidades"}`}</span>
                <Link href="/admin/produtos">Ajustar estoque</Link>
              </article>
            ))}
          </div> : <p className="stock-alert-empty">Nenhum produto ativo precisa de reposição neste momento.</p>}
          {lowStockCount > lowStockProducts.length && <p className="stock-alert-more">Mais {lowStockCount - lowStockProducts.length} produto(s) com estoque baixo.</p>}
        </section>

        <section className="orders-panel" id="pedidos">
          <div className="panel-heading"><div><h3>Pedidos recentes</h3><p>Pedidos registrados no checkout</p></div><Link href="/admin/pedidos">Ver todos <ArrowUpRight size={14} /></Link></div>
          {orders.length ? <div className="orders-table">
            <div className="order-row order-head"><span>Pedido</span><span>Cliente</span><span>Data</span><span>Status</span><span>Subtotal</span></div>
            {orders.map((order) => <div className="order-row" key={order.id}>
              <strong>{order.number}</strong>
              <span>{order.customerName ?? "Cliente"}</span>
              <time dateTime={order.createdAt.toISOString()}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(order.createdAt)}</time>
              <span><i className={`status-dot status-${order.status.toLowerCase()}`} />{statusLabels[order.status]}</span>
              <strong>{formatPrice(Number(order.subtotal))}</strong>
            </div>)}
          </div> : <p className="orders-empty">Nenhum pedido registrado.</p>}
        </section>
        <p className="admin-demo-note">Pagamentos, gráfico de vendas e produtos mais vendidos são demonstrativos. Pedidos, produtos ativos e pendências vêm do banco de dados.</p>
      </section>
  );
}
