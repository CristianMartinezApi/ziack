import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyMercadoPagoSignature(input: {
  dataId: string;
  requestId: string | null;
  signature: string | null;
  secret: string;
}) {
  if (!input.requestId || !input.signature) return false;
  const fields = Object.fromEntries(
    input.signature.split(",").map((part) => {
      const separator = part.indexOf("=");
      return separator < 0 ? ["", ""] : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
    }),
  );
  const timestamp = fields.ts;
  const receivedHash = fields.v1;
  if (!timestamp || !receivedHash || !/^\d+$/.test(input.dataId)) return false;

  const manifest = `id:${input.dataId.toLowerCase()};request-id:${input.requestId};ts:${timestamp};`;
  const expectedHash = createHmac("sha256", input.secret).update(manifest).digest();
  let actualHash: Buffer;
  try {
    actualHash = Buffer.from(receivedHash, "hex");
  } catch {
    return false;
  }
  return actualHash.length === expectedHash.length && timingSafeEqual(actualHash, expectedHash);
}
