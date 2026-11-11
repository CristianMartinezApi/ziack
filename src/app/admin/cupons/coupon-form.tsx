"use client";

import { useActionState } from "react";
import { Check, Plus } from "lucide-react";
import { createCoupon, toggleCoupon, type CouponActionState } from "./actions";

const initialState: CouponActionState = { message: "", success: false };

export function CouponForm() {
  const [state, formAction, pending] = useActionState(createCoupon, initialState);

  return (
    <form action={formAction} className="coupon-form">
      <label>Código do cupom<input name="code" minLength={3} maxLength={32} placeholder="PARCEIRO10" pattern="[A-Za-z0-9_-]+" required /></label>
      <label>Nome do parceiro<input name="partnerName" minLength={2} maxLength={100} placeholder="Nome do parceiro" required /></label>
      <label>E-mail do parceiro <span>(opcional)</span><input name="partnerEmail" type="email" maxLength={254} placeholder="parceiro@email.com" /></label>
      <label>Tipo de desconto<select name="discountType" defaultValue="PERCENTAGE"><option value="PERCENTAGE">Percentual</option><option value="FIXED">Valor fixo</option></select></label>
      <label>Desconto<input name="discountValue" type="number" min="0.01" max="100000" step="0.01" placeholder="10" required /></label>
      <label>Pedido mínimo (R$) <span>(opcional)</span><input name="minimumSubtotal" type="number" min="0" step="0.01" placeholder="Sem mínimo" /></label>
      <label>Início da validade <span>(opcional)</span><input name="startsAt" type="datetime-local" /></label>
      <label>Fim da validade <span>(opcional)</span><input name="expiresAt" type="datetime-local" /></label>
      <label>Limite de usos <span>(opcional)</span><input name="maxUses" type="number" min="1" step="1" placeholder="Ilimitado" /></label>
      <button className="button button-dark" type="submit" disabled={pending}>{pending ? "Salvando..." : "Criar cupom"} <Plus size={15} /></button>
      {state.message && <p className={state.success ? "settings-feedback settings-feedback-success" : "settings-feedback settings-feedback-error"} role={state.success ? "status" : "alert"}>{state.success && <Check size={14} />}{state.message}</p>}
    </form>
  );
}

export function CouponToggle({ id, active }: { id: string; active: boolean }) {
  const [state, formAction, pending] = useActionState(toggleCoupon, initialState);
  return (
    <form action={formAction} className="coupon-toggle-form">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending}>{pending ? "Aguarde..." : active ? "Desativar" : "Reativar"}</button>
      {state.message && <p className={state.success ? "settings-feedback settings-feedback-success" : "settings-feedback settings-feedback-error"} role={state.success ? "status" : "alert"}>{state.message}</p>}
    </form>
  );
}
