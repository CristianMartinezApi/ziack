import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { getStoreSettings } from "@/lib/store-settings";
import { CheckoutHeader } from "../checkout-form";

export const metadata = { title: "Retorno do pagamento | Ziack" };
export const dynamic = "force-dynamic";

export default async function CheckoutReturnPage() {
  const settings = await getStoreSettings();
  return <main className="checkout-page">
    <CheckoutHeader storeName={settings.storeName} label="Verificação do pagamento" />
    <section className="checkout-content">
      <div className="checkout-success" aria-live="polite">
        <span className="checkout-success-icon"><ShieldCheck size={24} /></span>
        <p className="eyebrow">Retorno do Mercado Pago</p>
        <h1>Estamos confirmando seu pagamento.</h1>
        <p>O retorno do navegador não confirma a compra. O pedido só será atualizado depois que a Ziack validar a notificação assinada do Mercado Pago.</p>
        <Link className="button button-dark" href="/">Voltar à loja <ArrowRight size={16} /></Link>
      </div>
    </section>
  </main>;
}
