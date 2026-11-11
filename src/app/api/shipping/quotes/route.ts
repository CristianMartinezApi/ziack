import { z } from "zod";
import { calculateMelhorEnvioQuotes, getShippingIntegrationStatus, MelhorEnvioIssue } from "@/lib/melhor-envio";

const requestSchema = z.object({
  destinationPostalCode: z.string().trim().regex(/^\d{5}-?\d{3}$/),
  items: z.array(z.object({
    productId: z.string().min(1).max(80),
    quantity: z.number().int().min(1).max(10),
  })).min(1).max(30).superRefine((items, context) => {
    const productIds = new Set<string>();
    items.forEach((item, index) => {
      if (productIds.has(item.productId)) {
        context.addIssue({ code: "custom", path: [index, "productId"], message: "Produto duplicado na sacola." });
      }
      productIds.add(item.productId);
    });
  }),
});

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 20_000) {
    return Response.json({ message: "A solicitação de cotação excedeu o tamanho permitido." }, { status: 413 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Não foi possível ler os dados da cotação." }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ message: "Informe um CEP válido e revise os itens da sacola." }, { status: 400 });

  const integration = await getShippingIntegrationStatus();
  if (integration.status !== "connected") {
    return Response.json({ message: integration.message }, { status: 503 });
  }

  try {
    const quotes = await calculateMelhorEnvioQuotes(
      parsed.data.destinationPostalCode.replace(/\D/g, ""),
      parsed.data.items,
    );
    if (!quotes.length) {
      return Response.json({ message: "O Melhor Envio não encontrou modalidades para este endereço e produtos." }, { status: 422 });
    }
    return Response.json({ quotes });
  } catch (error) {
    if (error instanceof MelhorEnvioIssue) return Response.json({ message: error.message }, { status: 422 });
    console.error("Melhor Envio: falha ao cotar frete.", error instanceof Error ? error.message : "Erro inesperado.");
    return Response.json({ message: "Não foi possível consultar os fretes agora. Tente novamente." }, { status: 502 });
  }
}
