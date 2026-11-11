"use client";

import { useActionState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { advanceOrderStatus, type OrderStatusActionState } from "./actions";
import { nextOrderStatus, nextOrderStatusLabels } from "@/lib/order-status";
import type { OrderStatus } from "@prisma/client";

const initialState: OrderStatusActionState = { message: "", success: false };

export function OrderStatusAction({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const [state, formAction, pending] = useActionState(advanceOrderStatus, initialState);
  const targetStatus = nextOrderStatus[status];
  if (!targetStatus) return null;

  const paymentConfirmation = status === "PENDING";

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (paymentConfirmation && !window.confirm("Confirme que o pagamento foi recebido fora da loja antes de avançar este pedido.")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="targetStatus" value={targetStatus} />
      <button className="order-status-action-button" type="submit" disabled={pending}>
        {pending ? "Atualizando..." : nextOrderStatusLabels[status]}
        {!pending && <ArrowRight size={14} />}
      </button>
      {paymentConfirmation && <small className="order-payment-reminder">Pagamento não integrado: confirme o recebimento antes de avançar.</small>}
      {state.message && <p className={state.success ? "order-action-success" : "order-action-error"} role={state.success ? "status" : "alert"}>{state.success && <Check size={14} />}{state.message}</p>}
    </form>
  );
}
