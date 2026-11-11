import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const uploadDirectory = join(process.cwd(), "data", "uploads");

const imageFormats = {
  "image/jpeg": { extension: "jpg", matches: (bytes: Buffer) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  "image/png": { extension: "png", matches: (bytes: Buffer) => bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/webp": { extension: "webp", matches: (bytes: Buffer) => bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP" },
} as const;

export async function saveProductImage(file: File): Promise<string> {
  if (file.size === 0 || file.size > MAX_IMAGE_SIZE) {
    throw new Error("A imagem deve ter entre 1 byte e 5 MB.");
  }

  const format = imageFormats[file.type as keyof typeof imageFormats];
  if (!format) throw new Error("Formato de imagem não aceito. Use JPEG, PNG ou WebP.");

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!format.matches(bytes)) throw new Error("O conteúdo do arquivo não corresponde a uma imagem JPEG, PNG ou WebP válida.");

  await mkdir(uploadDirectory, { recursive: true });
  const filename = `${randomUUID()}.${format.extension}`;
  await writeFile(join(uploadDirectory, filename), bytes, { flag: "wx", mode: 0o640 });
  return `/uploads/${filename}`;
}
