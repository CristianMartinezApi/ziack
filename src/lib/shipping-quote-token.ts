import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const quotePayloadSchema = z.object({
  version: z.literal(1),
  originPostalCode: z.string().regex(/^\d{8}$/),
  destinationPostalCode: z.string().regex(/^\d{8}$/),
  cartHash: z.string().regex(/^[a-f0-9]{64}$/),
  serviceId: z.string().min(1).max(40),
  service: z.string().min(1).max(100),
  company: z.string().min(1).max(100),
  price: z.string().regex(/^\d{1,8}\.\d{2}$/),
  deliveryDays: z.number().int().min(0).max(365),
  expiresAt: z.number().int().positive(),
});

export type ShippingQuotePayload = z.infer<typeof quotePayloadSchema>;

export type ShippingCartLine = {
  id: string;
  quantity: number;
  price: { toString(): string } | number | string;
  weight: { toString(): string } | number | string | null;
  width: number | null;
  height: number | null;
  length: number | null;
};

function getSigningKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("Configure AUTH_SECRET com pelo menos 32 caracteres.");
  return createHash("sha256").update(`ziack-shipping-quote:${secret}`).digest();
}

export function createShippingCartHash(lines: ShippingCartLine[]) {
  const stableLines = lines.map((line) => ({
    id: line.id,
    quantity: line.quantity,
    price: line.price.toString(),
    weight: line.weight?.toString() ?? null,
    width: line.width,
    height: line.height,
    length: line.length,
  })).sort((left, right) => left.id.localeCompare(right.id));
  return createHash("sha256").update(JSON.stringify(stableLines)).digest("hex");
}

export function createShippingQuoteToken(payload: ShippingQuotePayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", getSigningKey()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyShippingQuoteToken(value: string) {
  const [body, encodedSignature, ...extra] = value.split(".");
  if (!body || !encodedSignature || extra.length) return null;

  const expected = createHmac("sha256", getSigningKey()).update(body).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(encodedSignature, "base64url");
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const parsed = quotePayloadSchema.safeParse(JSON.parse(Buffer.from(body, "base64url").toString("utf8")));
    if (!parsed.success || parsed.data.expiresAt <= Date.now()) return null;
    return parsed.data;
  } catch {
    return null;
  }
}
