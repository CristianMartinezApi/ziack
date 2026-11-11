"use client";

import { useActionState } from "react";
import { Check, Save } from "lucide-react";
import { saveStoreSettings, type SettingsState } from "./actions";
import type { PublicStoreSettings } from "@/lib/store-settings";
import type { ShippingIntegrationStatus } from "@/lib/shipping-types";

const initialState: SettingsState = { message: "", success: false };

export function SettingsForm({ settings, shippingOriginPostalCode, shippingIntegration, connectionMessage = "" }: {
  settings: PublicStoreSettings;
  shippingOriginPostalCode: string;
  shippingIntegration: ShippingIntegrationStatus;
  connectionMessage?: string;
}) {
  const [state, formAction, pending] = useActionState(saveStoreSettings, initialState);

  return (
    <form action={formAction} className="settings-form">
      <section className="settings-section">
        <div className="settings-section-heading">
          <h2>Dados da loja</h2>
          <p>Informações de contato exibidas no checkout.</p>
        </div>
        <div className="settings-fields">
          <label className="settings-field-wide">Nome da loja<input name="storeName" defaultValue={settings.storeName} maxLength={100} required /></label>
          <label>E-mail de contato<input name="contactEmail" type="email" autoComplete="email" defaultValue={settings.contactEmail ?? ""} maxLength={254} placeholder="contato@ziack.com.br" /></label>
          <label>Telefone de contato<input name="contactPhone" type="tel" autoComplete="tel" defaultValue={settings.contactPhone ?? ""} maxLength={20} placeholder="(11) 99999-9999" /></label>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-heading">
          <h2>Frete e prazo</h2>
          <p>O valor configurado é recalculado e salvo pelo servidor ao registrar cada pedido.</p>
        </div>
        <div className="settings-fields">
          <label>CEP de origem dos envios<input name="shippingOriginPostalCode" inputMode="numeric" autoComplete="postal-code" defaultValue={shippingOriginPostalCode} placeholder="00000-000" minLength={8} maxLength={9} /><small>CEP do endereço da Ziack cadastrado no Melhor Envio.</small></label>
          <label>Frete padrão manual (R$)<input name="shippingFee" type="number" min="0" max="100000" step="0.01" defaultValue={settings.shippingFee ?? ""} placeholder="Deixe vazio para confirmar depois" /><small>Usado apenas quando a conta do Melhor Envio não estiver conectada.</small></label>
          <label>Frete grátis a partir de (R$)<input name="freeShippingThreshold" type="number" min="0" max="100000" step="0.01" defaultValue={settings.freeShippingThreshold ?? ""} placeholder="Opcional" /><small>Quando atingido, o checkout aplica frete grátis.</small></label>
          <label>Prazo estimado de envio (dias)<input name="shippingDeadlineDays" type="number" min="1" max="90" step="1" defaultValue={settings.shippingDeadlineDays ?? ""} placeholder="Opcional" /><small>Prazo informativo, exibido no checkout.</small></label>
        </div>
        <div className="settings-section-heading">
          <h2>Conta Melhor Envio</h2>
          <p>Autorize a conta de envio da Ziack para consultar as cotações no checkout.</p>
        </div>
        {connectionMessage && <p className="settings-feedback settings-feedback-error" role="alert">{connectionMessage}</p>}
        {shippingIntegration.status === "connected" ? (
          <p className="settings-feedback settings-feedback-success" role="status">
            Conta conectada no ambiente {shippingIntegration.mode === "sandbox" ? "de testes" : "de produção"}.
          </p>
        ) : (
          <>
            <p className="settings-feedback">{shippingIntegration.message}</p>
            {shippingIntegration.status === "ready-to-connect" && (
              <a className="button button-dark" href="/api/admin/melhor-envio/connect">Conectar conta Melhor Envio</a>
            )}
          </>
        )}
      </section>

      <section className="settings-section">
        <div className="settings-section-heading">
          <h2>Checkout e pedidos</h2>
          <p>Revise os avisos que o cliente verá antes de enviar o pedido.</p>
        </div>
        <div className="settings-fields settings-fields-single">
          <label>Aviso do checkout<textarea name="checkoutNotice" defaultValue={settings.checkoutNotice} maxLength={300} minLength={5} rows={3} required /></label>
          <label>Política de pedidos<textarea name="orderPolicy" defaultValue={settings.orderPolicy} maxLength={1000} minLength={5} rows={5} required /></label>
        </div>
      </section>

      {state.message && <p className={state.success ? "settings-feedback settings-feedback-success" : "settings-feedback settings-feedback-error"} role={state.success ? "status" : "alert"}>{state.success && <Check size={15} />}{state.message}</p>}
      <div className="settings-actions">
        <button className="button button-dark" type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar configurações"} <Save size={15} /></button>
      </div>
    </form>
  );
}
