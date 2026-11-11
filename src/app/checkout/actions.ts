"use server";

import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createMercadoPagoPreference, getMercadoPagoAvailability } from "@/lib/mercado-pago";
import { releaseOrderReservation } from "@/lib/order-reservations";
import { getShippingIntegrationStatus, validateShippingQuote, MelhorEnvioIssue } from "@/lib/melhor-envio";

const checkoutSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(10).max(20).regex(/^[+\d\s().-]+$/),
  postalCode: z.string().trim().regex(/^\d{5}-?\d{3}$/),
  state: z.string().trim().regex(/^[a-zA-Z]{2}$/),
  city: z.string().trim().min(2).max(80),
  neighborhood: z.string().trim().min(2).max(80),
  street: z.string().trim().min(2).max(120),
  addressNumber: z.string().trim().min(1).max(20),
  complement: z.string().trim().max(80),
  items: z.string().min(2).max(8000),
  couponCode: z.string().trim().max(32).optional().default(""),
  shippingQuoteToken: z.string().max(5000).optional().default(""),
});

const cartSchema = z.array(z.object({
  productId: z.string().min(1).max(80),
  quantity: z.number().int().min(1).max(10),
})).min(1).max(30).superRefine((items, context) => {
  const productIds = new Set<string>();
  items.forEach((item, index) => {
    if (productIds.has(item.productId)) {
      context.addIssue({ code: "custom", path: [index, "productId"], message: "Produto duplicado na sacola." });
    }
    productIds.add(item.productId);
  });
});

export type CheckoutState = {
  message: string;
  orderNumber?: string;
  subtotal?: string;
  discount?: string;
  couponCode?: string | null;
  shipping?: string | null;
  total?: string | null;
  paymentUrl?: string;
};

class CheckoutIssue extends Error {}

export async function createOrder(_previousState: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const paymentAvailability = getMercadoPagoAvailability();
  const shippingIntegration = await getShippingIntegrationStatus();
  if (paymentAvailability.status === "unavailable") {
    return { message: paymentAvailability.message };
  }

  const parsed = checkoutSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { message: "Confira seus dados de contato e entrega antes de continuar." };
  }

  let submittedItems: unknown;
  try {
    submittedItems = JSON.parse(parsed.data.items);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { message: "A sacola não pôde ser validada. Atualize a página e tente novamente." };
    }
    throw error;
  }

  const cart = cartSchema.safeParse(submittedItems);
  if (!cart.success) {
    return { message: "A sacola está inválida. Revise os itens e tente novamente." };
  }

  try {
    const order = await prisma.$transaction(async (transaction) => {
      const products = await transaction.product.findMany({
        where: { id: { in: cart.data.map((item) => item.productId) }, active: true, category: { active: true } },
      });

      if (products.length !== cart.data.length) {
        throw new CheckoutIssue("Uma das peças não está mais disponível. Atualize sua sacola.");
      }

      const productById = new Map(products.map((product) => [product.id, product]));
      let subtotal = new Prisma.Decimal(0);
      const orderItems = cart.data.map((item) => {
        const product = productById.get(item.productId);
        if (!product) throw new CheckoutIssue("Uma das peças não está mais disponível. Atualize sua sacola.");
        if (product.stock < item.quantity) {
          throw new CheckoutIssue(product.stock === 0
            ? `${product.name} está sem estoque no momento. Remova a peça da sacola para continuar.`
            : `Há apenas ${product.stock} unidade(s) de ${product.name} disponível(is). Ajuste a quantidade na sacola.`);
        }
        subtotal = subtotal.plus(product.price.mul(item.quantity));
        return { product, quantity: item.quantity };
      });

      const couponCode = parsed.data.couponCode.toUpperCase();
      const coupon = couponCode ? await transaction.partnerCoupon.findUnique({ where: { code: couponCode } }) : null;
      if (couponCode && !coupon) throw new CheckoutIssue("Esse cupom não existe ou foi digitado incorretamente.");
      if (coupon && !coupon.active) throw new CheckoutIssue("Esse cupom não está ativo.");
      const now = new Date();
      if (coupon?.startsAt && coupon.startsAt > now) throw new CheckoutIssue("Esse cupom ainda não está válido.");
      if (coupon?.expiresAt && coupon.expiresAt <= now) throw new CheckoutIssue("A validade desse cupom terminou.");
      if (coupon?.maxUses !== null && coupon && coupon.usageCount >= coupon.maxUses) {
        throw new CheckoutIssue("Esse cupom atingiu o limite de utilizações.");
      }
      if (coupon?.minimumSubtotal && subtotal.lt(coupon.minimumSubtotal)) {
        throw new CheckoutIssue(`O pedido mínimo para esse cupom é ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(coupon.minimumSubtotal))}.`);
      }

      const discount = coupon
        ? coupon.discountType === "PERCENTAGE"
          ? subtotal.mul(coupon.discountValue).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
          : Prisma.Decimal.min(subtotal, coupon.discountValue)
        : new Prisma.Decimal(0);
      const discountedSubtotal = subtotal.minus(discount);
      const storeSettings = await transaction.storeSettings.findUnique({ where: { id: "store" } });
      let shipping: Prisma.Decimal | null;
      let shippingQuoteData: Record<string, string | number> | null = null;
      if (shippingIntegration.status === "connected") {
        if (!parsed.data.shippingQuoteToken) {
          throw new CheckoutIssue("Consulte e selecione uma opção do Melhor Envio antes de continuar.");
        }
        try {
          const quote = await validateShippingQuote(
            parsed.data.shippingQuoteToken,
            parsed.data.postalCode,
            orderItems.map(({ product, quantity }) => ({ ...product, quantity })),
          );
          shipping = new Prisma.Decimal(quote.price);
          shippingQuoteData = {
            provider: "MELHOR_ENVIO",
            serviceId: quote.serviceId,
            service: quote.service,
            company: quote.company,
            originPostalCode: quote.originPostalCode,
            destinationPostalCode: quote.destinationPostalCode,
            deliveryDays: quote.deliveryDays,
            expiresAt: new Date(quote.expiresAt).toISOString(),
          };
        } catch (error) {
          if (error instanceof MelhorEnvioIssue) throw new CheckoutIssue(error.message);
          throw error;
        }
      } else {
        const freeShippingThreshold = storeSettings?.freeShippingThreshold;
        shipping = freeShippingThreshold && discountedSubtotal.gte(freeShippingThreshold)
          ? new Prisma.Decimal(0)
          : storeSettings?.shippingFee ?? null;
      }
      const total = shipping === null ? null : discountedSubtotal.plus(shipping);
      if (paymentAvailability.status === "ready" && shipping === null) {
        throw new CheckoutIssue("Configure o frete nas configurações da loja antes de aceitar pagamentos.");
      }
      if (paymentAvailability.status === "ready" && total?.lte(0)) {
        throw new CheckoutIssue("O total do pedido precisa ser maior que zero para iniciar o pagamento.");
      }

      for (const item of orderItems) {
        const reserved = await transaction.product.updateMany({
          where: { id: item.product.id, active: true, category: { active: true }, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (reserved.count !== 1) {
          throw new CheckoutIssue(`Estoque insuficiente para ${item.product.name}. Atualize a sacola.`);
        }
      }

      if (coupon) {
        const usageLimit = await transaction.partnerCoupon.updateMany({
          where: {
            id: coupon.id,
            active: true,
            AND: [
              { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
              { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
              { OR: [{ maxUses: null }, { maxUses: coupon.maxUses, usageCount: { lt: coupon.maxUses ?? 0 } }] },
            ],
          },
          data: { usageCount: { increment: 1 } },
        });
        if (usageLimit.count !== 1) throw new CheckoutIssue("Esse cupom acabou de atingir o limite de utilizações. Tente outro cupom.");
      }

      const number = `ZK-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}`;
      return transaction.order.create({
        data: {
          number,
          status: "PENDING",
          paymentProvider: paymentAvailability.status === "ready" ? "MERCADO_PAGO" : null,
          subtotal,
          discount,
          shipping,
          total,
          couponId: coupon?.id,
          couponCode: coupon?.code,
          customerName: parsed.data.name,
          customerEmail: parsed.data.email.toLowerCase(),
          customerPhone: parsed.data.phone,
          shippingData: {
            postalCode: parsed.data.postalCode,
            state: parsed.data.state.toUpperCase(),
            city: parsed.data.city,
            neighborhood: parsed.data.neighborhood,
            street: parsed.data.street,
            number: parsed.data.addressNumber,
            complement: parsed.data.complement,
            ...(shippingQuoteData ?? {}),
          },
          items: {
            create: orderItems.map(({ product, quantity }) => ({
              quantity,
              unitPrice: product.price,
              productId: product.id,
            })),
          },
        },
        select: {
          id: true,
          number: true,
          subtotal: true,
          discount: true,
          couponCode: true,
          shipping: true,
          total: true,
          customerEmail: true,
        },
      });
    });

    revalidatePath("/admin");
    if (paymentAvailability.status === "ready") {
      try {
        if (!order.total || !order.customerEmail) {
          throw new Error("Pedido sem total ou e-mail para iniciar o pagamento.");
        }
        const preference = await createMercadoPagoPreference({
          orderId: order.id,
          orderNumber: order.number,
          customerEmail: order.customerEmail,
          total: Number(order.total),
        });
        const savedPreference = await prisma.order.updateMany({
          where: { id: order.id, status: "PENDING", paymentProvider: "MERCADO_PAGO" },
          data: {
            paymentPreferenceId: preference.id,
            paymentStatus: "pending",
            paymentExpiresAt: preference.expiresAt,
          },
        });
        if (savedPreference.count !== 1) {
          throw new Error("O pedido não pôde ser associado à preferência de pagamento.");
        }

        return {
          message: "",
          orderNumber: order.number,
          subtotal: order.subtotal.toFixed(2),
          discount: order.discount.toFixed(2),
          couponCode: order.couponCode,
          shipping: order.shipping?.toFixed(2) ?? null,
          total: order.total?.toFixed(2) ?? null,
          paymentUrl: preference.checkoutUrl,
        };
      } catch (error) {
        console.error("Mercado Pago: falha ao criar a preferência de pagamento.", error instanceof Error ? error.message : "Erro inesperado.");
        await prisma.$transaction(async (transaction) => {
          const createdOrder = await transaction.order.findUnique({
            where: { id: order.id },
            select: { status: true, couponId: true, items: { select: { productId: true, quantity: true } } },
          });
          if (!createdOrder || createdOrder.status !== "PENDING") return;
          const cancelled = await transaction.order.updateMany({
            where: { id: order.id, status: "PENDING" },
            data: { status: "CANCELLED" },
          });
          if (cancelled.count === 1) await releaseOrderReservation(transaction, createdOrder);
        });
        revalidatePath("/admin");
        return { message: "Não foi possível iniciar o pagamento. O pedido foi cancelado e o estoque liberado; tente novamente." };
      }
    }

    return {
      message: "",
      orderNumber: order.number,
      subtotal: order.subtotal.toFixed(2),
      discount: order.discount.toFixed(2),
      couponCode: order.couponCode,
      shipping: order.shipping?.toFixed(2) ?? null,
      total: order.total?.toFixed(2) ?? null,
    };
  } catch (error) {
    if (error instanceof CheckoutIssue) return { message: error.message };
    throw error;
  }
}
