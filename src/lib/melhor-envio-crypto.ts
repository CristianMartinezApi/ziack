import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function getEncryptionKey() {
  const rawKey = process.env.MELHORENVIO_TOKEN_ENCRYPTION_KEY?.trim();
  if (!rawKey || !/^[a-fA-F0-9]{64}$/.test(rawKey)) {
    throw new Error("Configure MELHORENVIO_TOKEN_ENCRYPTION_KEY com uma chave aleatória hexadecimal de 64 caracteres.");
  }
  return Buffer.from(rawKey, "hex");
}

export function encryptShippingToken(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptShippingToken(value: string) {
  const [encodedIv, encodedTag, encodedData, ...extra] = value.split(".");
  if (!encodedIv || !encodedTag || !encodedData || extra.length) throw new Error("Token Melhor Envio armazenado em formato inválido.");
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(encodedIv, "base64url"));
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encodedData, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
