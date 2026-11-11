import "server-only";
import { MercadoPagoConfig, Payment, Preference } from "mercadopago";
import type { PreferenceRequest } from "mercadopago/dist/clients/preference/commonTypes";
import { z } from "zod";

const modeSchema = z.enum(["sandbox", "production"]);

export type MercadoPagoAvailability =
  | { status: "demo" }
  | { status: "unavailable"; message: string }
  | { status: "ready"; mode: "sandbox" | "production" };

function getSettings() {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) return { availability: { status: "demo" } as const };

  const parsedMode = modeSchema.safeParse(process.env.MERCADOPAGO_MODE ?? "sandbox");
  if (!parsedMode.success) {
    return { availability: { status: "unavailable", message: "O modo do Mercado Pago está inválido." } as const };
  }

  const mode = parsedMode.data;
  const validToken = mode === "sandbox"
    ? token.startsWith("TEST-") || token.startsWith("APP_USR-")
    : token.startsWith("APP_USR-");
  if (!validToken) {
    return {
      availability: {
        status: "unavailable",
        message: mode === "sandbox"
          ? "Use um Access Token de teste do Mercado Pago."
          : "Use um Access Token de produção do Mercado Pago.",
      } as const,
    };
  }

  const appUrl = parseUrl(process.env.APP_URL);
  const webhookUrl = parseUrl(process.env.MERCADOPAGO_WEBHOOK_URL);
  if (!appUrl || !["http:", "https:"].includes(appUrl.protocol) || mode === "production" && appUrl.protocol !== "https:") {
    return { availability: { status: "unavailable", message: "Configure APP_URL com o endereço público da loja." } as const };
  }
  if (!webhookUrl || webhookUrl.protocol !== "https:" || webhookUrl.pathname !== "/api/webhooks/mercado-pago") {
    return {
      availability: {
        status: "unavailable",
        message: "Configure uma URL HTTPS pública para o webhook do Mercado Pago.",
      } as const,
    };
  }
  if (!process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim()) {
    return {
      availability: {
        status: "unavailable",
        message: "Configure o segredo de assinatura do webhook do Mercado Pago.",
      } as const,
    };
  }

  return { availability: { status: "ready", mode } as const, token, appUrl, webhookUrl };
}

function parseUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash) return null;
    return url;
  } catch {
    return null;
  }
}

export function getMercadoPagoAvailability(): MercadoPagoAvailability {
  return getSettings().availability;
}

function getClients() {
  const settings = getSettings();
  const token = "token" in settings ? settings.token : undefined;
  const appUrl = "appUrl" in settings ? settings.appUrl : undefined;
  const webhookUrl = "webhookUrl" in settings ? settings.webhookUrl : undefined;
  if (settings.availability.status !== "ready" || !token || !appUrl || !webhookUrl) {
    throw new Error(settings.availability.status === "unavailable"
      ? settings.availability.message
      : "O Mercado Pago ainda não está configurado.");
  }

  const client = new MercadoPagoConfig({ accessToken: token });
  return {
    availability: settings.availability,
    appUrl,
    webhookUrl,
    payment: new Payment(client),
    preference: new Preference(client),
  };
}

export async function createMercadoPagoPreference(input: {
  orderId: string;
  orderNumber: string;
  customerEmail: string;
  total: number;
}) {
  const { availability, appUrl, webhookUrl, preference } = getClients();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  const returnUrl = new URL("/checkout/retorno", appUrl).toString();
  const body: PreferenceRequest = {
    items: [{
      id: input.orderNumber,
      title: `Pedido Ziack ${input.orderNumber}`,
      quantity: 1,
      unit_price: input.total,
      currency_id: "BRL",
    }],
    payer: { email: input.customerEmail },
    external_reference: input.orderId,
    notification_url: webhookUrl.toString(),
    back_urls: { success: returnUrl, pending: returnUrl, failure: returnUrl },
    expires: true,
    expiration_date_from: new Date().toISOString(),
    expiration_date_to: expiresAt.toISOString(),
    statement_descriptor: "ZIACK",
  };
  const response = await preference.create({
    body,
    requestOptions: { idempotencyKey: input.orderId },
  });
  const checkoutUrl = availability.mode === "sandbox"
    ? response.sandbox_init_point
    : response.init_point;
  if (!response.id || !checkoutUrl || !checkoutUrl.startsWith("https://")) {
    throw new Error("Mercado Pago não retornou os dados necessários para o checkout.");
  }

  return { id: response.id, checkoutUrl, expiresAt };
}

export async function getMercadoPagoPayment(paymentId: string) {
  const { payment } = getClients();
  return payment.get({ id: paymentId });
}

export async function searchMercadoPagoPayments(orderId: string) {
  const { payment } = getClients();
  return payment.search({ options: { external_reference: orderId, limit: 100 } });
}
