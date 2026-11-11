import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { getMelhorEnvioAuthorizationUrl, MelhorEnvioIssue } from "@/lib/melhor-envio";

export async function GET() {
  const session = await getAdminSession();
  if (!session) redirect("/admin-login");

  const state = randomBytes(32).toString("base64url");
  const cookieStore = await cookies();
  cookieStore.set("ziack-melhor-envio-oauth-state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/integrations/melhor-envio/callback",
    maxAge: 10 * 60,
  });

  try {
    const authorizationUrl = await getMelhorEnvioAuthorizationUrl(state);
    return Response.redirect(authorizationUrl);
  } catch (error) {
    cookieStore.delete("ziack-melhor-envio-oauth-state");
    const message = error instanceof MelhorEnvioIssue ? error.message : "Não foi possível iniciar a conexão Melhor Envio.";
    return Response.redirect(new URL(`/admin/configuracoes?melhor-envio=erro&mensagem=${encodeURIComponent(message)}`, process.env.APP_URL ?? "http://localhost:3000"));
  }
}
