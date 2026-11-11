import { CheckoutForm, CheckoutHeader } from "./checkout-form";
import { getStoreSettings } from "@/lib/store-settings";
import { getMercadoPagoAvailability } from "@/lib/mercado-pago";
import { getShippingIntegrationStatus } from "@/lib/melhor-envio";

export const dynamic = "force-dynamic";
export const metadata = { title: "Checkout | Ziack" };

export default async function CheckoutPage() {
  const [settings, shippingIntegration] = await Promise.all([
    getStoreSettings(),
    getShippingIntegrationStatus(),
  ]);
  const paymentAvailability = getMercadoPagoAvailability();
  return <main className="checkout-page">
    <CheckoutHeader
      storeName={settings.storeName}
      label={paymentAvailability.status === "ready" ? "Checkout Mercado Pago" : "Checkout demonstrativo"}
    />
    <section className="checkout-content">
      <p className="eyebrow">Quase sua</p>
      <h1>Uma última confirmação.</h1>
      <p className="checkout-intro">{paymentAvailability.status === "ready"
        ? "Preencha seus dados para conferir o frete e seguir ao ambiente seguro do Mercado Pago."
        : "Preencha seus dados para registrar o pedido e confirmar o frete."}</p>
      <CheckoutForm settings={settings} paymentAvailability={paymentAvailability} shippingIntegration={shippingIntegration} />
    </section>
  </main>;
}
