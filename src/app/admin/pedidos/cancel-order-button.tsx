"use client";

import { useActionState } from "react";
import { cancelOrder, type CancelOrderState } from "./actions";

const initialState: CancelOrderState = { message: "", success: false };

export function CancelOrderButton({ orderId, paymentProvider, paymentExpiresAt, createdAt }: {
  orderId: string;
  paymentProvider: string | null;
  paymentExpiresAt: Date | null;
  createdAt: Date;
}) {
  const [state, formAction, pending] = useActionState(cancelOrder, initialState);
  const isMercadoPago = paymentProvider === "MERCADO_PAGO";
  const cancellationAvailableAt = new Date((paymentExpiresAt ?? new Date(createdAt.getTime() + 5 * 60 * 1000)).getTime() + 5 * 60 * 1000);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        const prompt = isMercadoPago
          ? "Confirmar no Mercado Pago que não há pagamento pendente e cancelar o pedido?"
          : "Cancelar este pedido e devolver os itens ao estoque?";
        if (!window.confirm(prompt)) event.preventDefault();
      }}
    >
      <input type="hidden" name="orderId" value={orderId} />
      <button className="order-cancel-button" type="submit" disabled={pending}>
        {pending ? "Verificando..." : isMercadoPago ? "Verificar e cancelar" : "Cancelar pedido"}
      </button>
      {isMercadoPago && <small className="order-payment-reminder">Cancelamento disponível após {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(cancellationAvailableAt)} e conferência das tentativas no Mercado Pago.</small>}
      {state.message && <p className={state.success ? "order-action-success" : "order-action-error"} role={state.success ? "status" : "alert"}>{state.message}</p>}
    </form>
  );
}
