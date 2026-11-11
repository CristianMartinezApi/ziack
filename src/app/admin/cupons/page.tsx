import Link from "next/link";
import { ArrowLeft, TicketPercent } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/products";
import { CouponForm, CouponToggle } from "./coupon-form";

export const dynamic = "force-dynamic";

function formatDiscount(type: "PERCENTAGE" | "FIXED", value: number) {
  return type === "PERCENTAGE" ? `${value}%` : formatPrice(value);
}

export default async function AdminCouponsPage() {
  const coupons = await prisma.partnerCoupon.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <main className="admin-content manage-page">
      <header className="manage-header">
        <div>
          <Link href="/admin" className="back-link"><ArrowLeft size={15} /> Visão geral</Link>
          <p className="eyebrow">PARCERIAS DA ZIACK</p>
          <h1>Cupons <span>{coupons.length}</span></h1>
        </div>
        <Link href="/admin/produtos" className="button button-dark">Ver produtos</Link>
      </header>

      <div className="manage-toolbar"><p>Crie descontos para parceiros. O checkout valida e aplica o desconto no servidor.</p></div>
      <section className="coupon-create-panel">
        <h2><TicketPercent size={16} /> Cadastrar cupom de parceiro</h2>
        <CouponForm />
      </section>

      <section className="coupon-list">
        <div className="panel-heading"><div><h2>Cupons cadastrados</h2><p>{coupons.length} cupons</p></div></div>
        {coupons.length ? coupons.map((coupon) => (
          <article className="coupon-row" key={coupon.id}>
            <div className="coupon-code"><strong>{coupon.code}</strong><span>{coupon.partnerName}{coupon.partnerEmail ? ` · ${coupon.partnerEmail}` : ""}</span></div>
            <div className="coupon-value"><strong>{formatDiscount(coupon.discountType, Number(coupon.discountValue))}</strong><span>{coupon.discountType === "PERCENTAGE" ? "de desconto" : "de desconto fixo"}</span></div>
            <div className="coupon-usage"><strong>{coupon.usageCount}{coupon.maxUses ? ` / ${coupon.maxUses}` : ""}</strong><span>usos{coupon.minimumSubtotal ? ` · mínimo ${formatPrice(Number(coupon.minimumSubtotal))}` : ""}</span></div>
            <div className={coupon.active ? "coupon-state live" : "coupon-state"}>{coupon.active ? "Ativo" : "Inativo"}</div>
            <CouponToggle id={coupon.id} active={coupon.active} />
            {(coupon.startsAt || coupon.expiresAt) && <small className="coupon-validity">{coupon.startsAt ? `A partir de ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(coupon.startsAt)}` : "Sem início definido"} · {coupon.expiresAt ? `até ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(coupon.expiresAt)}` : "sem validade final"}</small>}
          </article>
        )) : <div className="no-orders"><TicketPercent size={24} /><p>Nenhum cupom cadastrado.</p><span>Os cupons ativos poderão ser usados no checkout.</span></div>}
      </section>
      <p className="manage-note">O uso do cupom é contabilizado junto com o pedido em transação. Desativar um cupom não altera pedidos já registrados.</p>
    </main>
  );
}
