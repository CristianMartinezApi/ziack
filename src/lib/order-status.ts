import type { OrderStatus } from "@prisma/client";

export const orderStatusLabels: Record<OrderStatus, string> = {
  PENDING: "Aguardando confirmação",
  PAID: "Pagamento recebido",
  PREPARING: "Em preparação",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
};

export const orderFulfillmentSteps: Exclude<OrderStatus, "CANCELLED">[] = [
  "PENDING",
  "PAID",
  "PREPARING",
  "SHIPPED",
  "DELIVERED",
];

export const nextOrderStatus: Partial<Record<OrderStatus, Exclude<OrderStatus, "PENDING" | "CANCELLED">>> = {
  PENDING: "PAID",
  PAID: "PREPARING",
  PREPARING: "SHIPPED",
  SHIPPED: "DELIVERED",
};

export const nextOrderStatusLabels: Partial<Record<OrderStatus, string>> = {
  PENDING: "Confirmar pagamento recebido",
  PAID: "Iniciar preparação",
  PREPARING: "Marcar como enviado",
  SHIPPED: "Marcar como entregue",
};
