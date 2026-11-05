"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeft, LockKeyhole, Sparkles } from "lucide-react";
import { loginAction } from "./actions";

export default function AdminLoginPage() {
  const [state, action, pending] = useActionState(loginAction, { error: "" });
  return <main className="login-page"><div className="login-card"><Link className="wordmark" href="/">ziack<span>.</span></Link><p className="eyebrow"><Sparkles size={12} /> ESPAÇO DA MARCA</p><h1>Bom ter você<br /><em>por aqui.</em></h1><p className="login-description">Entre para acompanhar sua loja e cuidar de cada detalhe.</p><form action={action} className="login-form"><label htmlFor="email">E-mail</label><input id="email" name="email" type="email" autoComplete="username" placeholder="voce@ziack.com.br" required /><label htmlFor="password">Senha</label><input id="password" name="password" type="password" autoComplete="current-password" placeholder="Sua senha" required />{state.error && <p className="login-error" role="alert">{state.error}</p>}<button className="button button-dark" disabled={pending}>{pending ? "Entrando…" : "Entrar no painel"}<LockKeyhole size={15} /></button></form><Link href="/" className="login-back"><ArrowLeft size={14} /> Voltar para a loja</Link></div><div className="login-art"><div className="login-orbit" /><div className="login-ring" /><span>ZIACK · FEITO COM INTENÇÃO</span></div></main>;
}
