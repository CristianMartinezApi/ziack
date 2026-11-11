import { readFile } from "node:fs/promises";
import { join } from "node:path";

const imageTypes = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

export async function GET(_request: Request, { params }: RouteContext<"/uploads/[filename]">) {
  const { filename } = await params;
  const match = /^([a-f0-9-]{36})\.(jpg|png|webp)$/.exec(filename);
  if (!match) return new Response("Not found", { status: 404 });

  try {
    const bytes = await readFile(join(process.cwd(), "data", "uploads", filename));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": imageTypes[match[2] as keyof typeof imageTypes],
        "Content-Length": String(bytes.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return new Response("Not found", { status: 404 });
    }
    throw error;
  }
}
