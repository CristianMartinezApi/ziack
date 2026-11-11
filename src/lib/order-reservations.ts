import "server-only";
import type { Prisma } from "@prisma/client";

type OrderReservation = {
  couponId: string | null;
  items: Array<{ productId: string; quantity: number }>;
};

export async function releaseOrderReservation(transaction: Prisma.TransactionClient, order: OrderReservation) {
  for (const item of order.items) {
    await transaction.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity } },
    });
  }

  if (order.couponId) {
    const releasedUse = await transaction.partnerCoupon.updateMany({
      where: { id: order.couponId, usageCount: { gt: 0 } },
      data: { usageCount: { decrement: 1 } },
    });
    if (releasedUse.count !== 1) throw new Error("Não foi possível liberar a utilização do cupom deste pedido.");
  }
}
