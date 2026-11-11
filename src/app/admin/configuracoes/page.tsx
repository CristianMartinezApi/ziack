import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getStoreSettings } from "@/lib/store-settings";
import { SettingsForm } from "./settings-form";
import { prisma } from "@/lib/prisma";
import { getShippingIntegrationStatus } from "@/lib/melhor-envio";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ "melhor-envio"?: string; mensagem?: string }>;
}) {
  const settings = await getStoreSettings();
  const [query, shippingOriginPostalCode, shippingIntegration] = await Promise.all([
    searchParams,
    prisma.storeSettings.findUnique({ where: { id: "store" }, select: { shippingOriginPostalCode: true } }),
    getShippingIntegrationStatus(),
  ]);

  return (
    <main className="admin-content manage-page">
      <header className="manage-header">
        <div>
          <Link href="/admin" className="back-link"><ArrowLeft size={15} /> Visão geral</Link>
          <p className="eyebrow">PREFERÊNCIAS DA LOJA</p>
          <h1>Configurações</h1>
        </div>
      </header>
      <div className="manage-toolbar">
        <p>Edite os dados públicos, as condições de frete e as informações do checkout.</p>
      </div>
      <SettingsForm
        settings={settings}
        shippingOriginPostalCode={shippingOriginPostalCode?.shippingOriginPostalCode ?? ""}
        shippingIntegration={shippingIntegration}
        connectionMessage={query["melhor-envio"] === "erro" ? query.mensagem?.slice(0, 300) ?? "Não foi possível conectar a conta." : ""}
      />
      <p className="manage-note">Alterações no frete afetam novos pedidos. Pedidos já registrados mantêm os valores salvos originalmente.</p>
    </main>
  );
}
