import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { decryptShippingToken, encryptShippingToken } from "@/lib/melhor-envio-crypto";
import {
  createShippingCartHash,
  createShippingQuoteToken,
  verifyShippingQuoteToken,
  type ShippingCartLine,
} from "@/lib/shipping-quote-token";
import type { ShippingIntegrationStatus, ShippingQuoteOption } from "@/lib/shipping-types";

const modeSchema = z.enum(["sandbox", "production"]);
const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.coerce.number().int().positive(),
});
const serviceResponseSchema = z.array(z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string().min(1),
  price: z.coerce.number().nonnegative(),
  custom_price: z.coerce.number().nonnegative().optional(),
  delivery_time: z.number().int().nonnegative().optional(),
  custom_delivery_time: z.number().int().nonnegative().optional(),
  company: z.object({ name: z.string().min(1) }),
}));

export class MelhorEnvioIssue extends Error {}

function getMode() {
  const parsed = modeSchema.safeParse(process.env.MELHORENVIO_MODE ?? "sandbox");
  if (!parsed.success) throw new MelhorEnvioIssue("O ambiente do Melhor Envio está configurado incorretamente.");
  return parsed.data;
}

function getBaseUrl(mode: "sandbox" | "production") {
  return mode === "sandbox" ? "https://sandbox.melhorenvio.com.br" : "https://melhorenvio.com.br";
}

function getAppCredentials() {
  const clientId = process.env.MELHORENVIO_CLIENT_ID?.trim();
  const clientSecret = process.env.MELHORENVIO_CLIENT_SECRET?.trim();
  const redirectUri = process.env.MELHORENVIO_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) {
    throw new MelhorEnvioIssue("Configure as credenciais do aplicativo Melhor Envio e a URL de callback no servidor.");
  }
  let callback: URL;
  try {
    callback = new URL(redirectUri);
  } catch {
    throw new MelhorEnvioIssue("A URL de callback do Melhor Envio está inválida.");
  }
  if (!["http:", "https:"].includes(callback.protocol) || callback.pathname !== "/api/integrations/melhor-envio/callback" || callback.search || callback.hash) {
    throw new MelhorEnvioIssue("A callback deve apontar para /api/integrations/melhor-envio/callback e corresponder à URL cadastrada no aplicativo.");
  }
  if (getMode() === "production" && callback.protocol !== "https:") {
    throw new MelhorEnvioIssue("A callback do Melhor Envio em produção precisa usar HTTPS.");
  }
  const encryptionKey = process.env.MELHORENVIO_TOKEN_ENCRYPTION_KEY?.trim();
  if (!encryptionKey || !/^[a-fA-F0-9]{64}$/.test(encryptionKey)) {
    throw new MelhorEnvioIssue("Configure MELHORENVIO_TOKEN_ENCRYPTION_KEY com uma chave aleatória hexadecimal de 64 caracteres.");
  }
  return { clientId, clientSecret, redirectUri };
}

export async function getShippingIntegrationStatus(): Promise<ShippingIntegrationStatus> {
  let mode: "sandbox" | "production";
  try {
    mode = getMode();
    getAppCredentials();
  } catch (error) {
    return {
      status: "not-configured",
      message: error instanceof MelhorEnvioIssue ? error.message : "Não foi possível verificar a configuração do Melhor Envio.",
    };
  }

  const integration = await prisma.shippingIntegration.findUnique({
    where: { id: "store" },
    select: { mode: true },
  });
  if (integration?.mode === mode) return { status: "connected", mode };
  if (integration) {
    return {
      status: "ready-to-connect",
      message: "A autorização salva pertence a outro ambiente. Autorize novamente para conectar a conta no ambiente atual.",
    };
  }
  return {
    status: "ready-to-connect",
    message: `Aplicativo configurado. Conecte a conta Ziack no ambiente ${mode === "sandbox" ? "de testes" : "de produção"}.`,
  };
}

export async function getMelhorEnvioAuthorizationUrl(state: string) {
  const mode = getMode();
  const { clientId, redirectUri } = getAppCredentials();
  const url = new URL("/oauth/authorize", getBaseUrl(mode));
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "shipping-calculate");
  url.searchParams.set("state", state);
  return url;
}

async function exchangeToken(body: Record<string, string>, mode: "sandbox" | "production") {
  const { clientId, clientSecret } = getAppCredentials();
  const contactEmail = await getContactEmail();
  const response = await fetch(new URL("/oauth/token", getBaseUrl(mode)), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": `Ziack (${contactEmail})`,
    },
    body: JSON.stringify({ ...body, client_id: clientId, client_secret: clientSecret }),
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new MelhorEnvioIssue(response.status === 401 || response.status === 400
      ? "O Melhor Envio recusou a autorização. Confira o aplicativo, o callback e o ambiente configurados."
      : "O Melhor Envio não conseguiu concluir a autorização. Tente novamente.");
  }
  const parsed = tokenResponseSchema.safeParse(result);
  if (!parsed.success) throw new MelhorEnvioIssue("O Melhor Envio retornou dados de autorização inválidos.");
  return parsed.data;
}

export async function authorizeMelhorEnvio(code: string) {
  const mode = getMode();
  const { redirectUri } = getAppCredentials();
  const tokens = await exchangeToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  }, mode);
  const encryptionKey = process.env.MELHORENVIO_TOKEN_ENCRYPTION_KEY;
  if (!encryptionKey) throw new MelhorEnvioIssue("Configure a chave de criptografia dos tokens Melhor Envio no servidor.");

  await prisma.shippingIntegration.upsert({
    where: { id: "store" },
    create: {
      id: "store",
      mode,
      accessTokenEncrypted: encryptShippingToken(tokens.access_token),
      refreshTokenEncrypted: encryptShippingToken(tokens.refresh_token),
      accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
    update: {
      mode,
      accessTokenEncrypted: encryptShippingToken(tokens.access_token),
      refreshTokenEncrypted: encryptShippingToken(tokens.refresh_token),
      accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
  });
}

async function refreshAccessToken(force: boolean) {
  const mode = getMode();
  const current = await prisma.shippingIntegration.findUnique({ where: { id: "store" } });
  if (!current || current.mode !== mode) throw new MelhorEnvioIssue("A conta do Melhor Envio ainda não está conectada neste ambiente.");
  if (!force && current.accessTokenExpiresAt.getTime() > Date.now() + 5 * 60 * 1000) {
    return decryptShippingToken(current.accessTokenEncrypted);
  }

  try {
    const refreshed = await exchangeToken({
      grant_type: "refresh_token",
      refresh_token: decryptShippingToken(current.refreshTokenEncrypted),
    }, mode);
    const updated = await prisma.shippingIntegration.updateMany({
      where: { id: "store", refreshTokenEncrypted: current.refreshTokenEncrypted },
      data: {
        accessTokenEncrypted: encryptShippingToken(refreshed.access_token),
        refreshTokenEncrypted: encryptShippingToken(refreshed.refresh_token),
        accessTokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      },
    });
    if (updated.count === 1) return refreshed.access_token;
  } catch (error) {
    const latest = await prisma.shippingIntegration.findUnique({ where: { id: "store" } });
    if (
      latest?.mode === mode &&
      latest.refreshTokenEncrypted !== current.refreshTokenEncrypted &&
      latest.accessTokenExpiresAt.getTime() > Date.now() + 60 * 1000
    ) {
      return decryptShippingToken(latest.accessTokenEncrypted);
    }
    throw error;
  }

  const latest = await prisma.shippingIntegration.findUnique({ where: { id: "store" } });
  if (latest?.mode === mode && latest.accessTokenExpiresAt.getTime() > Date.now() + 60 * 1000) {
    return decryptShippingToken(latest.accessTokenEncrypted);
  }
  throw new MelhorEnvioIssue("Não foi possível renovar o acesso ao Melhor Envio. Reconecte a conta Ziack.");
}

async function getContactEmail() {
  const settings = await prisma.storeSettings.findUnique({
    where: { id: "store" },
    select: { contactEmail: true },
  });
  const email = settings?.contactEmail?.trim() || process.env.MELHORENVIO_CONTACT_EMAIL?.trim();
  if (!email) throw new MelhorEnvioIssue("Configure o e-mail de suporte da loja nas configurações antes de consultar o frete.");
  return email;
}

async function callShippingApi(destinationPostalCode: string, lines: ShippingCartLine[], forceRefresh = false): Promise<unknown> {
  const mode = getMode();
  const settings = await prisma.storeSettings.findUnique({
    where: { id: "store" },
    select: { shippingOriginPostalCode: true },
  });
  const originPostalCode = settings?.shippingOriginPostalCode?.replace(/\D/g, "");
  if (!originPostalCode || !/^\d{8}$/.test(originPostalCode)) {
    throw new MelhorEnvioIssue("Cadastre um CEP de origem válido em Configurações da loja.");
  }
  const contactEmail = await getContactEmail();
  const products = lines.map((line) => {
    if (line.weight === null || line.width === null || line.height === null || line.length === null) {
      throw new MelhorEnvioIssue("Preencha peso e dimensões dos produtos no painel antes de calcular o frete.");
    }
    return {
      id: line.id,
      width: line.width,
      height: line.height,
      length: line.length,
      weight: Number(line.weight),
      insurance_value: Number(line.price),
      quantity: line.quantity,
    };
  });
  const payload = {
    from: { postal_code: originPostalCode },
    to: { postal_code: destinationPostalCode },
    products,
  };

  const send = async (token: string) => fetch(new URL("/api/v2/me/shipment/calculate", getBaseUrl(mode)), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "User-Agent": `Ziack (${contactEmail})`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  });

  let response = await send(await refreshAccessToken(forceRefresh));
  if (response.status === 401) response = await send(await refreshAccessToken(true));
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new MelhorEnvioIssue(response.status === 401 || response.status === 403
      ? "A autorização da conta Melhor Envio expirou ou não possui permissão de cotação. Reconecte a conta."
      : "O Melhor Envio não conseguiu calcular o frete para este endereço e produtos.");
  }
  return result;
}

export async function calculateMelhorEnvioQuotes(destinationPostalCode: string, submittedItems: Array<{ productId: string; quantity: number }>) {
  const products = await prisma.product.findMany({
    where: {
      id: { in: submittedItems.map((item) => item.productId) },
      active: true,
      category: { active: true },
    },
  });
  if (products.length !== submittedItems.length) throw new MelhorEnvioIssue("A sacola contém produtos indisponíveis. Atualize a página.");
  const productsById = new Map(products.map((product) => [product.id, product]));
  const lines = submittedItems.map((item) => {
    const product = productsById.get(item.productId);
    if (!product) throw new MelhorEnvioIssue("A sacola contém produtos indisponíveis. Atualize a página.");
    if (product.stock < item.quantity) throw new MelhorEnvioIssue(`Estoque insuficiente para ${product.name}.`);
    return { ...product, quantity: item.quantity };
  });
  const response = await callShippingApi(destinationPostalCode, lines);
  const parsed = serviceResponseSchema.safeParse(response);
  if (!parsed.success) throw new MelhorEnvioIssue("A resposta do Melhor Envio não trouxe opções de frete válidas.");
  const origin = await prisma.storeSettings.findUnique({
    where: { id: "store" },
    select: { shippingOriginPostalCode: true },
  });
  const originPostalCode = origin?.shippingOriginPostalCode?.replace(/\D/g, "") ?? "";
  const cartHash = createShippingCartHash(lines);
  const expiresAt = Date.now() + 10 * 60 * 1000;
  const quotes: ShippingQuoteOption[] = parsed.data.map((service) => {
    const price = service.custom_price ?? service.price;
    const deliveryDays = service.custom_delivery_time ?? service.delivery_time;
    if (!Number.isFinite(price) || deliveryDays === undefined || deliveryDays < 0) {
      throw new MelhorEnvioIssue("O Melhor Envio retornou uma modalidade sem preço ou prazo válido.");
    }
    const serviceId = String(service.id);
    const priceInCents = Math.round(price * 100);
    const normalizedPrice = (priceInCents / 100).toFixed(2);
    const company = service.company.name;
    return {
      id: serviceId,
      company,
      service: service.name,
      price: normalizedPrice,
      deliveryDays,
      quoteToken: createShippingQuoteToken({
        version: 1,
        originPostalCode,
        destinationPostalCode,
        cartHash,
        serviceId,
        service: service.name,
        company,
        price: normalizedPrice,
        deliveryDays,
        expiresAt,
      }),
    };
  });

  return quotes.sort((left, right) => Number(left.price) - Number(right.price));
}

export async function validateShippingQuote(
  token: string,
  destinationPostalCode: string,
  lines: ShippingCartLine[],
) {
  const payload = verifyShippingQuoteToken(token);
  if (!payload) throw new MelhorEnvioIssue("A cotação expirou ou é inválida. Calcule o frete novamente.");
  const origin = await prisma.storeSettings.findUnique({
    where: { id: "store" },
    select: { shippingOriginPostalCode: true },
  });
  const currentOrigin = origin?.shippingOriginPostalCode?.replace(/\D/g, "") ?? "";
  if (
    payload.destinationPostalCode !== destinationPostalCode.replace(/\D/g, "") ||
    payload.originPostalCode !== currentOrigin ||
    payload.cartHash !== createShippingCartHash(lines)
  ) {
    throw new MelhorEnvioIssue("O endereço ou os produtos mudaram após a cotação. Calcule o frete novamente.");
  }
  return payload;
}
