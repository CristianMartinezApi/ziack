import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  getMercadoPagoAvailability,
  getMercadoPagoPayment,
} from "@/lib/mercado-pago";
import { verifyMercadoPagoSignature } from "@/lib/mercado-pago-signature";

const webhookPayloadSchema = z.object({
  type: z.string().optional(),
  topic: z.string().optional(),
  data: z.object({ id: z.union([z.string(), z.number()]) }).optional(),
  id: z.union([z.string(), z.number()]).optional(),
});

const paymentSchema = z.object({
  id: z.union([z.string().min(1), z.number().int().positive()]),
  external_reference: z.string().min(1),
  status: z.string().min(1),
  status_detail: z.string().nullable().optional(),
  currency_id: z.literal("BRL"),
  transaction_amount: z.number().finite(),
  live_mode: z.boolean(),
});

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const parsedPayload = webhookPayloadSchema.safeParse(payload);
  if (!parsedPayload.success) return Response.json({ error: "Notificação inválida." }, { status: 400 });

  const url = new URL(request.url);
  const eventType = parsedPayload.data.type
    ?? parsedPayload.data.topic
    ?? url.searchParams.get("type")
    ?? url.searchParams.get("topic");
  if (eventType !== "payment") return Response.json({ received: true });

  const dataId = String(url.searchParams.get("data.id") ?? parsedPayload.data.data?.id ?? parsedPayload.data.id ?? "");
  const availability = getMercadoPagoAvailability();
  const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim();
  if (availability.status !== "ready" || !webhookSecret) {
    console.error("Mercado Pago: webhook recebido sem configuração ativa.");
    return Response.json({ error: "Webhook não configurado." }, { status: 503 });
  }

  if (!verifyMercadoPagoSignature({
    dataId,
    requestId: request.headers.get("x-request-id"),
    signature: request.headers.get("x-signature"),
    secret: webhookSecret,
  })) {
    return Response.json({ error: "Assinatura inválida." }, { status: 401 });
  }

  if (!/^\d+$/.test(dataId)) return Response.json({ error: "Identificador de pagamento inválido." }, { status: 400 });

  let paymentResponse;
  try {
    paymentResponse = await getMercadoPagoPayment(dataId);
  } catch (error) {
    console.error("Mercado Pago: falha ao consultar pagamento da notificação.", error instanceof Error ? error.message : "Erro inesperado.");
    return Response.json({ error: "Não foi possível consultar o pagamento." }, { status: 502 });
  }

  const parsedPayment = paymentSchema.safeParse(paymentResponse);
  if (!parsedPayment.success) {
    console.error("Mercado Pago: resposta da API não contém os campos de pagamento esperados.", dataId);
    return Response.json({ received: true, ignored: true });
  }
  const payment = parsedPayment.data;

  if (
    payment.live_mode !== (availability.mode === "production")
  ) {
    console.error("Mercado Pago: pagamento com campos inválidos ou ambiente divergente.", dataId);
    return Response.json({ received: true, ignored: true });
  }

  const order = await prisma.order.findUnique({
    where: { id: payment.external_reference },
    select: { id: true, status: true, total: true, paymentProvider: true, paymentPreferenceId: true, paymentId: true },
  });
  if (
    !order ||
    order.paymentProvider !== "MERCADO_PAGO" ||
    !order.paymentPreferenceId ||
    !order.total ||
    !new Prisma.Decimal(payment.transaction_amount).equals(order.total)
  ) {
    console.error("Mercado Pago: notificação não corresponde a pedido, preferência ou valor.", dataId);
    return Response.json({ received: true, ignored: true });
  }

  const paymentId = String(payment.id);
  const updated = await prisma.$transaction(async (transaction) => {
    const currentOrder = await transaction.order.findUnique({
      where: { id: order.id },
      select: { status: true, paymentId: true },
    });
    if (!currentOrder) return "missing" as const;
    if (currentOrder.status === "PAID") {
      return currentOrder.paymentId === paymentId ? "duplicate" as const : "already-paid" as const;
    }
    if (currentOrder.status === "CANCELLED" && payment.status === "approved") {
      const lateApproval = await transaction.order.updateMany({
        where: { id: order.id, status: "CANCELLED", paymentProvider: "MERCADO_PAGO" },
        data: { paymentId, paymentStatus: payment.status, paymentStatusDetail: payment.status_detail ?? null },
      });
      return lateApproval.count === 1 ? "late-approval" as const : "raced" as const;
    }
    if (currentOrder.status !== "PENDING") return "closed" as const;

    const result = await transaction.order.updateMany({
      where: {
        id: order.id,
        status: "PENDING",
        paymentProvider: "MERCADO_PAGO",
        paymentPreferenceId: { not: null },
      },
      data: {
        ...(payment.status === "approved" ? { status: "PAID" } : {}),
        paymentId,
        paymentStatus: payment.status,
        paymentStatusDetail: payment.status_detail ?? null,
      },
    });
    return result.count === 1 ? "updated" as const : "raced" as const;
  });

  if (updated === "missing" || updated === "closed" || updated === "already-paid") {
    console.error("Mercado Pago: notificação não aplicada ao estado atual do pedido.", dataId, updated);
    return Response.json({ received: true, ignored: true });
  }

  if (updated === "late-approval") {
    console.error("Mercado Pago: pagamento aprovado após cancelamento do pedido; intervenção administrativa necessária.", dataId);
  }

  if (updated === "raced") {
    const currentOrder = await prisma.order.findUnique({
      where: { id: order.id },
      select: { status: true, paymentId: true },
    });
    if (currentOrder?.status !== "PAID" || currentOrder.paymentId !== paymentId) {
      return Response.json({ error: "Pedido alterado durante a confirmação." }, { status: 409 });
    }
  }

  if (payment.status === "approved") {
    revalidatePath("/admin");
    revalidatePath("/admin/pedidos");
  }

  return Response.json({ received: true });
}
