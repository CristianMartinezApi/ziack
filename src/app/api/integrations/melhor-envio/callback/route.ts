import { cookies } from "next/headers";
import { getAdminSession } from "@/lib/admin-auth";
import { authorizeMelhorEnvio, MelhorEnvioIssue } from "@/lib/melhor-envio";

export async function GET(request: Request) {
  const callbackUrl = new URL("/admin/configuracoes", request.url);
  const query = new URL(request.url).searchParams;
  const returnedState = query.get("state");
  const code = query.get("code");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("ziack-melhor-envio-oauth-state")?.value;
  cookieStore.delete("ziack-melhor-envio-oauth-state");

  if (!returnedState || !expectedState || returnedState !== expectedState) {
    callbackUrl.searchParams.set("melhor-envio", "erro");
    callbackUrl.searchParams.set("mensagem", "A autorização expirou ou não pôde ser validada. Inicie a conexão novamente.");
    return Response.redirect(callbackUrl);
  }

  if (!await getAdminSession()) {
    callbackUrl.searchParams.set("melhor-envio", "erro");
    callbackUrl.searchParams.set("mensagem", "Entre no painel novamente e conecte a conta Melhor Envio.");
    return Response.redirect(callbackUrl);
  }

  const providerError = query.get("error");
  if (providerError || !code || code.length > 2000) {
    callbackUrl.searchParams.set("melhor-envio", "erro");
    callbackUrl.searchParams.set("mensagem", providerError === "access_denied"
      ? "A autorização foi cancelada no Melhor Envio."
      : "O Melhor Envio não concluiu a autorização. Tente conectar novamente.");
    return Response.redirect(callbackUrl);
  }

  try {
    await authorizeMelhorEnvio(code);
    callbackUrl.searchParams.set("melhor-envio", "conectado");
  } catch (error) {
    callbackUrl.searchParams.set("melhor-envio", "erro");
    callbackUrl.searchParams.set("mensagem", error instanceof MelhorEnvioIssue
      ? error.message
      : "Não foi possível concluir a autorização. Confira as configurações e tente novamente.");
  }
  return Response.redirect(callbackUrl);
}
