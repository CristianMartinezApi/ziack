import Link from "next/link";
import { ArrowLeft, ClipboardList, Package } from "lucide-react";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/products";
import { orderFulfillmentSteps, orderStatusLabels } from "@/lib/order-status";
import { CancelOrderButton } from "./cancel-order-button";
import { OrderStatusAction } from "./order-status-action";

export const dynamic = "force-dynamic";

const shippingAddressSchema = z.object({
  street: z.string(),
  number: z.string(),
  complement: z.string(),
  neighborhood: z.string(),
  city: z.string(),
  state: z.string(),
  postalCode: z.string(),
});

const shippingQuoteSchema = z.object({
  provider: z.literal("MELHOR_ENVIO"),
  service: z.string(),
  company: z.string(),
  deliveryDays: z.number(),
});

function getShippingAddress(value: unknown) {
  const parsed = shippingAddressSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function getShippingQuote(value: unknown) {
  const parsed = shippingQuoteSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export default async function AdminOrdersPage() {
  await requireAdmin();
  const orders = await prisma.order.findMany({
    include: { items: { include: { product: { select: { name: true, sku: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const pendingCount = orders.filter((order) => order.status === "PENDING").length;

  return (
    <main className="admin-content manage-page">
      <header className="manage-header">
        <div>
          <Link href="/admin" className="back-link"><ArrowLeft size={15} /> Visão geral</Link>
          <p className="eyebrow">OPERAÇÃO DA LOJA</p>
          <h1>Pedidos <span>{orders.length}</span></h1>
        </div>
        <Link href="/#colecao" className="button button-dark">Ver loja</Link>
      </header>

      <div className="manage-toolbar">
        <p>Consulte os pedidos, pagamentos e dados de entrega informados.</p>
        <span className="orders-pending-count">{pendingCount} aguardando confirmação</span>
      </div>

      <section className="admin-orders-list" aria-label="Pedidos recebidos">
        {orders.length ? orders.map((order) => {
          const address = getShippingAddress(order.shippingData);
          const shippingQuote = getShippingQuote(order.shippingData);
          const isPending = order.status === "PENDING";
          const currentStep = order.status === "CANCELLED" ? -1 : orderFulfillmentSteps.indexOf(order.status);

          return (
            <details className="admin-order" key={order.id}>
              <summary>
                <span className="order-summary-main">
                  <strong>{order.number}</strong>
                  <small>{order.customerName ?? "Cliente"} · {order.customerEmail ?? "E-mail não informado"}</small>
                </span>
                <span className={`order-status-badge order-status-${order.status.toLowerCase()}`}>{orderStatusLabels[order.status]}</span>
                <strong className="order-summary-total">{formatPrice(Number(order.total ?? order.subtotal.minus(order.discount)))}<small>{order.shipping === null ? "Frete a confirmar" : order.shipping.isZero() ? "Frete grátis" : `Frete ${formatPrice(Number(order.shipping))}`}</small></strong>
                <time dateTime={order.createdAt.toISOString()}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(order.createdAt)}</time>
              </summary>

              <div className="admin-order-details">
                {order.paymentProvider === "MERCADO_PAGO" && (
                  <p className="admin-order-note">
                    Pagamento Mercado Pago: {formatPaymentStatus(order.paymentStatus)}
                    {order.paymentStatusDetail ? ` (${order.paymentStatusDetail})` : ""}.
                    {order.paymentExpiresAt && order.status === "PENDING"
                      ? ` Checkout válido até ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(order.paymentExpiresAt)}.`
                      : ""}
                  </p>
                )}
                {order.status === "CANCELLED" ? (
                  <p className="order-cancelled-banner">
                    {order.paymentStatus === "approved"
                      ? "Atenção: o pagamento foi aprovado após o cancelamento. Verifique o atendimento ou o estorno; o estoque reservado foi devolvido."
                      : "Este pedido foi cancelado. O estoque reservado foi devolvido."}
                  </p>
                ) : (
                  <ol className="order-progress" aria-label={`Etapas do pedido: ${orderStatusLabels[order.status]}`}>
                    {orderFulfillmentSteps.map((step, index) => {
                      const complete = index < currentStep;
                      const current = index === currentStep;
                      return <li className={complete ? "complete" : current ? "current" : ""} key={step} aria-current={current ? "step" : undefined}>
                        <span className="order-progress-marker">{complete ? "✓" : index + 1}</span>
                        <span>{step === "PENDING" ? "Pedido recebido" : step === "PAID" ? "Pagamento recebido" : step === "PREPARING" ? "Em preparação" : step === "SHIPPED" ? "Enviado" : "Entregue"}</span>
                      </li>;
                    })}
                  </ol>
                )}
                <section>
                  <h2><Package size={15} /> Itens do pedido</h2>
                  {order.items.length ? <ul className="admin-order-items">
                    {order.items.map((item) => <li key={item.id}>
                      <span>{item.product.name}<small>SKU {item.product.sku} · {formatPrice(Number(item.unitPrice))} cada</small></span>
                      <strong>{item.quantity} × {formatPrice(Number(item.unitPrice))}</strong>
                    </li>)}
                  </ul> : <p className="admin-order-muted">Este pedido não possui itens.</p>}
                  <div className="admin-order-totals">
                    <span>Subtotal dos itens</span><strong>{formatPrice(Number(order.subtotal))}</strong>
                    {order.discount.isPositive() && <><span>Desconto{order.couponCode ? ` (${order.couponCode})` : ""}</span><strong>− {formatPrice(Number(order.discount))}</strong></>}
                    <span>Frete</span><strong>{order.shipping === null ? "A confirmar" : formatPrice(Number(order.shipping))}</strong>
                    <span>Total final</span><strong>{order.total === null ? "A confirmar" : formatPrice(Number(order.total))}</strong>
                  </div>
                </section>

                <section>
                  <h2>Contato e entrega</h2>
                  <p>{order.customerName ?? "Nome não informado"}</p>
                  <p>{order.customerEmail ?? "E-mail não informado"}</p>
                  <p>{order.customerPhone ?? "Telefone não informado"}</p>
                  {address ? <address>{address.street}, {address.number}{address.complement ? ` · ${address.complement}` : ""}<br />{address.neighborhood} · {address.city}/{address.state}<br />CEP {address.postalCode}</address> : <p className="admin-order-muted">Endereço de entrega não informado.</p>}
                  {shippingQuote && <p className="admin-order-muted">Frete via {shippingQuote.company} · {shippingQuote.service} · estimativa de {shippingQuote.deliveryDays} dia(s) útil(is).</p>}
                </section>

                <div className="admin-order-note">
                  <p>{order.status === "CANCELLED"
                    ? "Pedido cancelado; o estoque reservado foi devolvido."
                    : order.status === "PENDING"
                      ? order.paymentProvider === "MERCADO_PAGO"
                        ? "A confirmação do pagamento é automática e depende do webhook assinado do Mercado Pago."
                        : "Pedido demonstrativo aguardando confirmação de pagamento. Confirme o recebimento fora da loja antes de avançar."
                      : "Pagamento marcado como recebido manualmente. Nenhuma transação foi processada pelo painel."}
                    {order.shipping === null ? " O frete e o total final ainda precisam ser combinados com o cliente." : " O valor do frete foi calculado com as condições atuais da loja."}
                  </p>
                  <div className="order-status-controls">
                    {(order.status !== "PENDING" || order.paymentProvider !== "MERCADO_PAGO") && <OrderStatusAction orderId={order.id} status={order.status} />}
                    {isPending && <CancelOrderButton orderId={order.id} paymentProvider={order.paymentProvider} paymentExpiresAt={order.paymentExpiresAt} createdAt={order.createdAt} />}
                  </div>
                </div>
              </div>
            </details>
          );
        }) : <div className="no-orders">
          <ClipboardList size={25} />
          <p>Nenhum pedido registrado.</p>
          <span>Os pedidos feitos pelo checkout demonstrativo aparecerão aqui.</span>
        </div>}
      </section>

      <p className="manage-note">A atualização de status é manual. Ao avançar para “Pagamento recebido”, confirme primeiro o recebimento fora da loja; nenhuma transação é processada pelo painel. Pedidos sem frete calculado precisam de confirmação manual.</p>
    </main>
  );
}

function formatPaymentStatus(status: string | null) {
  if (!status) return "aguardando notificação";
  const labels: Record<string, string> = {
    pending: "pendente",
    approved: "aprovado",
    authorized: "autorizado",
    in_process: "em análise",
    rejected: "recusado",
    cancelled: "cancelado",
    refunded: "estornado",
    charged_back: "contestado",
  };
  return labels[status] ?? status;
}
