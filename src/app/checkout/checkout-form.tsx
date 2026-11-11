"use client";

import Link from "next/link";
import Image from "next/image";
import { useActionState, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ShieldCheck } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { createOrder, type CheckoutState } from "./actions";
import { formatPrice } from "@/lib/products";
import type { PublicStoreSettings } from "@/lib/store-settings";
import type { MercadoPagoAvailability } from "@/lib/mercado-pago";
import type { ShippingIntegrationStatus, ShippingQuoteOption } from "@/lib/shipping-types";
import { z } from "zod";

const initialState: CheckoutState = { message: "" };
const quoteResponseSchema = z.object({
  quotes: z.array(z.object({
    id: z.string(),
    company: z.string(),
    service: z.string(),
    price: z.string(),
    deliveryDays: z.number().int(),
    quoteToken: z.string(),
  })),
});

export function CheckoutForm({ settings, paymentAvailability, shippingIntegration }: {
  settings: PublicStoreSettings;
  paymentAvailability: MercadoPagoAvailability;
  shippingIntegration: ShippingIntegrationStatus;
}) {
  const { items, storageError, clearCart } = useCart();
  const [state, formAction, pending] = useActionState(createOrder, initialState);
  const [destinationPostalCode, setDestinationPostalCode] = useState("");
  const [quoteResult, setQuoteResult] = useState<{
    cartKey: string;
    destinationPostalCode: string;
    quotes: ShippingQuoteOption[];
  } | null>(null);
  const [selectedQuoteToken, setSelectedQuoteToken] = useState("");
  const [quoteError, setQuoteError] = useState("");
  const [quotePending, setQuotePending] = useState(false);
  const cartKey = JSON.stringify(items.map(({ id, quantity }) => ({ productId: id, quantity })));
  const normalizedPostalCode = destinationPostalCode.replace(/\D/g, "");
  const hasSavedQuotes = quoteResult?.cartKey === cartKey && quoteResult.destinationPostalCode === normalizedPostalCode;
  const quotes = hasSavedQuotes ? quoteResult.quotes : [];

  useEffect(() => {
    if (state.orderNumber) clearCart();
    if (state.paymentUrl) window.location.assign(state.paymentUrl);
  }, [state.orderNumber, state.paymentUrl, clearCart]);

  async function calculateQuotes() {
    if (!/^\d{5}-?\d{3}$/.test(destinationPostalCode.trim())) {
      setQuoteError("Informe um CEP válido para consultar as opções de envio.");
      return;
    }

    setQuotePending(true);
    setQuoteError("");
    setQuoteResult(null);
    setSelectedQuoteToken("");
    try {
      const response = await fetch("/api/shipping/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinationPostalCode,
          items: items.map(({ id, quantity }) => ({ productId: id, quantity })),
        }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = z.object({ message: z.string() }).safeParse(result);
        throw new Error(message.success ? message.data.message : "Não foi possível consultar os fretes. Tente novamente.");
      }

      const parsed = quoteResponseSchema.safeParse(result);
      if (!parsed.success) throw new Error("O serviço de frete retornou opções inválidas.");
      setQuoteResult({
        cartKey,
        destinationPostalCode: destinationPostalCode.replace(/\D/g, ""),
        quotes: parsed.data.quotes,
      });
      setSelectedQuoteToken(parsed.data.quotes[0]?.quoteToken ?? "");
      if (!parsed.data.quotes.length) setQuoteError("Não foram encontradas modalidades para este endereço e produtos.");
    } catch (error) {
      setQuoteResult(null);
      setSelectedQuoteToken("");
      setQuoteError(error instanceof Error ? error.message : "Não foi possível consultar os fretes. Tente novamente.");
    } finally {
      setQuotePending(false);
    }
  }

  if (state.paymentUrl) {
    return (
      <section className="checkout-success" aria-live="polite">
        <span className="checkout-success-icon"><ShieldCheck size={24} /></span>
        <p className="eyebrow">Pagamento seguro</p>
        <h1>Redirecionando ao Mercado Pago.</h1>
        <p>Seu pedido {state.orderNumber} está aguardando a confirmação automática do pagamento.</p>
      </section>
    );
  }

  if (state.orderNumber) {
    return (
      <section className="checkout-success" aria-live="polite">
        <span className="checkout-success-icon"><Check size={24} /></span>
        <p className="eyebrow">Pedido demonstrativo registrado</p>
        <h1>Obrigada por escolher a Ziack.</h1>
        <p>Seu pedido <strong>{state.orderNumber}</strong> foi registrado. O pagamento continua pendente; nenhum valor foi cobrado.</p>
        <div className="checkout-success-summary">
          <span>Subtotal dos produtos</span><strong>{formatPrice(Number(state.subtotal))}</strong>
          {state.discount && Number(state.discount) > 0 && <><span>Desconto {state.couponCode ? `(${state.couponCode})` : ""}</span><strong>− {formatPrice(Number(state.discount))}</strong></>}
          <span>Frete</span><strong>{state.shipping === null || state.shipping === undefined ? "A confirmar" : state.shipping === "0.00" ? "Grátis" : formatPrice(Number(state.shipping))}</strong>
          <span>Total</span><strong>{state.total === null || state.total === undefined ? "A confirmar" : formatPrice(Number(state.total))}</strong>
          <small>{settings.orderPolicy} Nenhuma cobrança foi realizada.</small>
        </div>
        <Link className="button button-dark" href="/">Voltar à loja <ArrowRight size={16} /></Link>
      </section>
    );
  }

  if (!items.length) {
    return (
      <section className="checkout-empty">
        <h1>Sua sacola está vazia.</h1>
        <p>Escolha uma peça para iniciar seu pedido demonstrativo.</p>
        <Link className="button button-dark" href="/#colecao">Voltar à coleção <ArrowRight size={16} /></Link>
      </section>
    );
  }

  const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);
  const selectedQuote = quotes.find((quote) => quote.quoteToken === selectedQuoteToken);
  const shippingQuote = shippingIntegration.status === "connected"
    ? selectedQuote ? Number(selectedQuote.price) : null
    : getShippingQuote(settings, subtotal);
  const unavailableItems = items.filter((item) => item.stock === 0 || item.stock !== undefined && item.quantity > item.stock);
  const missingShippingQuote = paymentAvailability.status === "ready" && shippingQuote === null;

  return (
    <div className="checkout-layout">
      <form className="checkout-form" action={formAction}>
        <fieldset disabled={pending || Boolean(storageError)}>
          <legend>Seus dados</legend>
          <div className="checkout-fields">
            <label>Nome completo<input name="name" autoComplete="name" minLength={2} maxLength={100} required /></label>
            <label>E-mail<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
            <label>Telefone<input name="phone" type="tel" autoComplete="tel" placeholder="(11) 99999-9999" minLength={10} maxLength={20} required /></label>
          </div>

          <legend>Endereço de entrega</legend>
          <div className="checkout-fields">
            <label>CEP<input name="postalCode" autoComplete="postal-code" placeholder="00000-000" minLength={8} maxLength={9} value={destinationPostalCode} onChange={(event) => {
              setDestinationPostalCode(event.target.value);
              setSelectedQuoteToken("");
              setQuoteError("");
            }} required /></label>
            <label>Estado<input name="state" autoComplete="address-level1" placeholder="SP" minLength={2} maxLength={2} required /></label>
            <label>Cidade<input name="city" autoComplete="address-level2" maxLength={80} required /></label>
            <label>Bairro<input name="neighborhood" autoComplete="address-level3" maxLength={80} required /></label>
            <label className="checkout-field-wide">Rua<input name="street" autoComplete="street-address" maxLength={120} required /></label>
            <label>Número<input name="addressNumber" maxLength={20} required /></label>
            <label>Complemento <span>(opcional)</span><input name="complement" autoComplete="address-line2" maxLength={80} /></label>
          </div>
          {shippingIntegration.status === "connected" && (
            <section className="shipping-quotes" aria-label="Opções de envio">
              <button
                className="button button-outline"
                type="button"
                onClick={calculateQuotes}
                disabled={quotePending || pending || Boolean(storageError) || unavailableItems.length > 0}
              >
                {quotePending ? "Consultando Melhor Envio..." : hasSavedQuotes ? "Atualizar opções de envio" : "Consultar opções de envio"}
              </button>
              {quoteError && <p className="checkout-message" role="alert">{quoteError}</p>}
              {quotes.map((quote) => (
                <label className="shipping-quote-option" key={quote.quoteToken}>
                  <input
                    type="radio"
                    name="shippingOption"
                    value={quote.quoteToken}
                    checked={selectedQuoteToken === quote.quoteToken}
                    onChange={() => setSelectedQuoteToken(quote.quoteToken)}
                  />
                  <span><strong>{quote.company} · {quote.service}</strong><small>Prazo estimado: {quote.deliveryDays} dia(s) útil(is)</small></span>
                  <strong>{formatPrice(Number(quote.price))}</strong>
                </label>
              ))}
            </section>
          )}

          <label className="checkout-coupon-field">Cupom de parceiro <span>(opcional)</span><input name="couponCode" autoCapitalize="characters" maxLength={32} placeholder="Digite o código do cupom" /></label>
        </fieldset>

        <input type="hidden" name="items" value={JSON.stringify(items.map(({ id, quantity }) => ({ productId: id, quantity })))} />
        <input type="hidden" name="shippingQuoteToken" value={selectedQuote ? selectedQuoteToken : ""} />
        {storageError && <p className="checkout-message" role="alert">{storageError}</p>}
        {unavailableItems.length > 0 && <p className="checkout-message" role="alert">Há produtos sem estoque suficiente na sacola. <Link href="/#colecao">Volte à loja e ajuste os itens</Link>.</p>}
        {state.message && <p className="checkout-message" role="alert">{state.message}</p>}
        {paymentAvailability.status === "unavailable" && <p className="checkout-message" role="alert">{paymentAvailability.message}</p>}
        {shippingIntegration.status === "connected" && !selectedQuote && <p className="checkout-message" role="status">Consulte e selecione uma opção do Melhor Envio para continuar.</p>}
        {missingShippingQuote && shippingIntegration.status !== "connected" && <p className="checkout-message" role="alert">Configure o frete nas configurações da loja antes de aceitar pagamentos.</p>}
        <p className="checkout-demo-notice"><ShieldCheck size={17} /> {paymentAvailability.status === "ready"
          ? `Pagamento pelo Mercado Pago (${paymentAvailability.mode === "sandbox" ? "ambiente de teste" : "produção"}). O pedido só será confirmado após validação automática.`
          : settings.checkoutNotice}</p>
        <button className="button button-dark checkout-submit" type="submit" disabled={pending || Boolean(storageError) || unavailableItems.length > 0 || paymentAvailability.status === "unavailable" || missingShippingQuote || shippingIntegration.status === "connected" && !selectedQuote}>
          {pending
            ? paymentAvailability.status === "ready" ? "Preparando pagamento..." : "Registrando pedido..."
            : paymentAvailability.status === "ready" ? "Pagar com Mercado Pago" : "Registrar pedido demonstrativo"} <ArrowRight size={16} />
        </button>
      </form>

      <aside className="checkout-summary">
        <h2>Resumo da sacola</h2>
        <div className="checkout-summary-items">
          {items.map((item) => <div className="checkout-summary-item" key={item.id}>
            <span className={`checkout-summary-art product-${item.tone}`}>{item.imageUrl ? <Image src={item.imageUrl} alt="" fill sizes="64px" /> : <i />}</span>
            <span className="checkout-summary-name">{item.name}<small>Qtd. {item.quantity} · {item.stock === 0 ? "Estoque indisponível" : item.stock === undefined ? "Disponibilidade a confirmar" : "Disponível"}</small></span>
            <strong>{formatPrice(item.price * item.quantity)}</strong>
          </div>)}
        </div>
        <div className="checkout-subtotal"><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></div>
        <p className="checkout-coupon-note">O cupom será validado no registro do pedido; o desconto confirmado aparecerá no resumo final.</p>
        <div className="checkout-shipping"><span>Frete</span><strong>{shippingQuote === null ? "A confirmar" : shippingQuote === 0 ? "Grátis" : formatPrice(shippingQuote)}</strong></div>
        <div className="checkout-subtotal checkout-total"><span>Total estimado</span><strong>{shippingQuote === null ? "A confirmar" : formatPrice(subtotal + shippingQuote)}</strong></div>
        {shippingIntegration.status === "connected" && selectedQuote
          ? <p className="checkout-shipping-deadline">Prazo estimado: {selectedQuote.deliveryDays} dia(s) útil(is).</p>
          : shippingIntegration.status !== "connected" && settings.shippingDeadlineDays !== null
            ? <p className="checkout-shipping-deadline">Prazo estimado de envio: até {settings.shippingDeadlineDays} dias.</p>
            : null}
        <p>{shippingIntegration.status === "connected"
          ? "Frete calculado pelo Melhor Envio. Prazo e preço são válidos para esta cotação."
          : paymentAvailability.status === "ready" ? "O frete e o total final foram calculados antes de iniciar o pagamento." : settings.orderPolicy}</p>
      </aside>
      {(settings.contactEmail || settings.contactPhone) && <footer className="checkout-contact">
        <span>Dúvidas? Fale com {settings.storeName}</span>
        {settings.contactEmail && <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>}
        {settings.contactPhone && <a href={`tel:${settings.contactPhone.replace(/[^\d+]/g, "")}`}>{settings.contactPhone}</a>}
      </footer>}
    </div>
  );
}

function getShippingQuote(settings: PublicStoreSettings, subtotal: number) {
  const fee = settings.shippingFee === null ? null : Number(settings.shippingFee);
  const threshold = settings.freeShippingThreshold === null ? null : Number(settings.freeShippingThreshold);
  if (threshold !== null && subtotal >= threshold) return 0;
  return fee;
}

export function CheckoutHeader({ storeName, label = "Checkout" }: { storeName: string; label?: string }) {
  return <header className="checkout-header"><Link className="checkout-back" href="/#colecao"><ArrowLeft size={15} /> Continuar comprando</Link><Link className="wordmark" href="/">{storeName}<span>.</span></Link><span className="checkout-header-note">{label}</span></header>;
}
