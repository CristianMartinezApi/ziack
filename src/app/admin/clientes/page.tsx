import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Users } from "lucide-react";
import { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/products";

export const dynamic = "force-dynamic";

const confirmedStatuses = new Set<OrderStatus>(["PAID", "PREPARING", "SHIPPED", "DELIVERED"]);
const statusLabels: Record<OrderStatus, string> = {
  PENDING: "Aguardando confirmação",
  PAID: "Pagamento confirmado",
  PREPARING: "Em separação",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
};

export default async function AdminCustomersPage() {
  const [ordersByCustomer, latestOrders] = await Promise.all([
    prisma.order.groupBy({
      by: ["customerEmail", "status"],
      where: { customerEmail: { not: null } },
      _count: { _all: true },
      _sum: { subtotal: true, discount: true },
    }),
    prisma.order.findMany({
      where: { customerEmail: { not: null } },
      distinct: ["customerEmail"],
      orderBy: { createdAt: "desc" },
      select: {
        customerEmail: true,
        customerName: true,
        customerPhone: true,
        customer: { select: { name: true, email: true } },
        number: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  const customerStats = new Map<string, {
    orderCount: number;
    pendingCount: number;
    confirmedOrderCount: number;
    confirmedSubtotal: Prisma.Decimal;
  }>();

  for (const group of ordersByCustomer) {
    if (!group.customerEmail) continue;
    const stats = customerStats.get(group.customerEmail) ?? {
      orderCount: 0,
      pendingCount: 0,
      confirmedOrderCount: 0,
      confirmedSubtotal: new Prisma.Decimal(0),
    };
    stats.orderCount += group._count._all;
    if (group.status === "PENDING") stats.pendingCount += group._count._all;
    if (confirmedStatuses.has(group.status)) {
      stats.confirmedOrderCount += group._count._all;
      stats.confirmedSubtotal = stats.confirmedSubtotal.plus(group._sum.subtotal ?? 0).minus(group._sum.discount ?? 0);
    }
    customerStats.set(group.customerEmail, stats);
  }

  const customers = latestOrders.flatMap((order) => {
    const email = order.customerEmail ?? order.customer?.email;
    if (!email) return [];
    const stats = customerStats.get(order.customerEmail ?? email);
    if (!stats) return [];
    return [{
      email,
      name: order.customerName ?? order.customer?.name ?? "Cliente",
      phone: order.customerPhone,
      latestOrderNumber: order.number,
      latestOrderStatus: order.status,
      latestOrderDate: order.createdAt,
      ...stats,
    }];
  });
  const pendingCustomers = customers.filter((customer) => customer.pendingCount > 0).length;
  const customersWithConfirmedOrders = customers.filter((customer) => customer.confirmedOrderCount > 0).length;

  return (
    <main className="admin-content manage-page">
      <header className="manage-header">
        <div>
          <Link href="/admin" className="back-link"><ArrowLeft size={15} /> Visão geral</Link>
          <p className="eyebrow">RELACIONAMENTO COM CLIENTES</p>
          <h1>Clientes <span>{customers.length}</span></h1>
        </div>
        <Link href="/admin/pedidos" className="button button-dark">Ver pedidos <ArrowUpRight size={15} /></Link>
      </header>

      <div className="manage-toolbar">
        <p>Contatos únicos registrados nos pedidos do checkout.</p>
        <span className="orders-pending-count">{pendingCustomers} com pedidos aguardando confirmação</span>
      </div>

      <section className="customer-stats" aria-label="Resumo de clientes">
        <article><span>Clientes cadastrados</span><strong>{customers.length}</strong><small>Identificados pelo e-mail</small></article>
        <article><span>Com compras confirmadas</span><strong>{customersWithConfirmedOrders}</strong><small>Pedidos pagos ou em atendimento</small></article>
        <article><span>Pedidos pendentes</span><strong>{pendingCustomers}</strong><small>Sem pagamento confirmado</small></article>
      </section>

      <section className="admin-customers-list" aria-label="Lista de clientes">
        {customers.length ? customers.map((customer) => (
          <article className="admin-customer" key={customer.email}>
            <div className="customer-avatar" aria-hidden="true">{customer.name.slice(0, 1).toUpperCase()}</div>
            <div className="customer-identity">
              <strong>{customer.name}</strong>
              <a href={`mailto:${customer.email}`}>{customer.email}</a>
              <span>{customer.phone ?? "Telefone não informado"}</span>
            </div>
            <div className="customer-metric">
              <span>Pedidos</span>
              <strong>{customer.orderCount}</strong>
            </div>
            <div className="customer-metric">
              <span>Compras confirmadas</span>
              <strong>{formatPrice(Number(customer.confirmedSubtotal))}</strong>
              <small>{customer.confirmedOrderCount} pedidos</small>
            </div>
            <div className="customer-latest-order">
              <span>Pedido mais recente</span>
              <strong>{customer.latestOrderNumber}</strong>
              <small>{statusLabels[customer.latestOrderStatus]} · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(customer.latestOrderDate)}</small>
            </div>
            <Link className="customer-orders-link" href="/admin/pedidos" aria-label={`Ver pedidos de ${customer.name}`}>
              Ver pedidos <ArrowUpRight size={14} />
            </Link>
          </article>
        )) : (
          <div className="no-orders">
            <Users size={25} />
            <p>Nenhum cliente registrado.</p>
            <span>Os contatos aparecerão aqui após o primeiro pedido pelo checkout.</span>
          </div>
        )}
      </section>

      <p className="manage-note">O valor de compras soma apenas pedidos pagos, em separação, enviados ou entregues; pedidos pendentes e cancelados não contam.</p>
    </main>
  );
}
