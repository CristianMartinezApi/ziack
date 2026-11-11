"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { nextOrderStatus } from "@/lib/order-status";
import { searchMercadoPagoPayments } from "@/lib/mercado-pago";
import { releaseOrderReservation } from "@/lib/order-reservations";

export type CancelOrderState = {
  message: string;
  success: boolean;
};

export type OrderStatusActionState = {
  message: string;
  success: boolean;
};

const orderIdSchema = z.string().cuid();
const targetStatusSchema = z.enum(["PAID", "PREPARING", "SHIPPED", "DELIVERED"]);

export async function advanceOrderStatus(_previousState: OrderStatusActionState, formData: FormData): Promise<OrderStatusActionState> {
  await requireAdmin();
  const parsedOrderId = orderIdSchema.safeParse(formData.get("orderId"));
  const parsedTarget = targetStatusSchema.safeParse(formData.get("targetStatus"));
  if (!parsedOrderId.success || !parsedTarget.success) {
    return { message: "Atualização inválida. Atualize a página e tente novamente.", success: false };
  }

  const order = await prisma.order.findUnique({
    where: { id: parsedOrderId.data },
    select: { status: true, paymentProvider: true },
  });
  if (!order) return { message: "Pedido não encontrado.", success: false };
  if (parsedTarget.data === "PAID" && order.paymentProvider === "MERCADO_PAGO") {
    return { message: "Este pedido só pode ser marcado como pago pela confirmação assinada do Mercado Pago.", success: false };
  }

  const allowedNextStatus = nextOrderStatus[order.status];
  if (allowedNextStatus !== parsedTarget.data) {
    return { message: "Esta mudança de status não é permitida. Atualize a página e tente novamente.", success: false };
  }

  const updated = await prisma.order.updateMany({
    where: { id: parsedOrderId.data, status: order.status },
    data: { status: parsedTarget.data },
  });
  if (updated.count !== 1) {
    return { message: "O pedido foi alterado em outra sessão. Atualize a página.", success: false };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin/clientes");
  return {
    message: parsedTarget.data === "PAID"
      ? "Pagamento marcado como recebido. Nenhum pagamento foi processado pela loja."
      : `Pedido atualizado: ${parsedTarget.data === "PREPARING" ? "em preparação" : parsedTarget.data === "SHIPPED" ? "enviado" : "entregue"}.`,
    success: true,
  };
}

export async function cancelOrder(_previousState: CancelOrderState, formData: FormData): Promise<CancelOrderState> {
  await requireAdmin();
  const parsedId = orderIdSchema.safeParse(formData.get("orderId"));
  if (!parsedId.success) {
    return { message: "Pedido inválido. Atualize a página e tente novamente.", success: false };
  }

  const paymentOrder = await prisma.order.findUnique({
    where: { id: parsedId.data },
    select: { status: true, paymentProvider: true, paymentPreferenceId: true, paymentExpiresAt: true, createdAt: true },
  });
  if (!paymentOrder) return { message: "Pedido não encontrado.", success: false };
  if (paymentOrder.status !== "PENDING") {
    return { message: "Este pedido não está mais pendente e não pode ser cancelado por esta ação.", success: false };
  }
  if (paymentOrder.paymentProvider === "MERCADO_PAGO") {
    const expiresAt = paymentOrder.paymentExpiresAt ?? new Date(paymentOrder.createdAt.getTime() + 5 * 60 * 1000);
    if (Date.now() < expiresAt.getTime() + 5 * 60 * 1000) {
      return { message: "Este checkout Mercado Pago ainda pode receber pagamento. Aguarde a expiração antes de cancelar.", success: false };
    }

    try {
      const payments = await searchMercadoPagoPayments(parsedId.data);
      const results = payments.results ?? [];
      if (payments.paging?.total !== results.length || results.some((payment) => !payment.status || !["rejected", "cancelled", "refunded", "charged_back"].includes(payment.status))) {
        return { message: "O Mercado Pago ainda apresenta uma tentativa de pagamento não encerrada. O pedido foi mantido e o estoque continua reservado.", success: false };
      }
    } catch (error) {
      console.error("Mercado Pago: falha ao verificar pagamentos antes do cancelamento.", error instanceof Error ? error.message : "Erro inesperado.");
      return { message: "Não foi possível confirmar a situação do pagamento no Mercado Pago. O pedido foi mantido.", success: false };
    }
  }

  const result = await prisma.$transaction(async (transaction) => {
    const order = await transaction.order.findUnique({
      where: { id: parsedId.data },
      select: { status: true, couponId: true, items: { select: { productId: true, quantity: true } } },
    });

    if (!order) return "not-found" as const;
    if (order.status !== "PENDING") return "not-pending" as const;

    const cancelled = await transaction.order.updateMany({
      where: { id: parsedId.data, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    if (cancelled.count !== 1) return "not-pending" as const;

    await releaseOrderReservation(transaction, order);

    return "cancelled" as const;
  });

  if (result === "not-found") {
    return { message: "Pedido não encontrado.", success: false };
  }
  if (result === "not-pending") {
    return { message: "Este pedido não está mais pendente e não pode ser cancelado por esta ação.", success: false };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin/produtos");
  revalidatePath("/admin/cupons");
  return { message: "Pedido cancelado e estoque devolvido.", success: true };
}
