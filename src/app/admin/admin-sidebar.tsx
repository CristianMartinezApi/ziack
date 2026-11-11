"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, ClipboardList, LayoutDashboard, LogOut, Settings, Tags, TicketPercent, Users } from "lucide-react";
import { logoutAction } from "./actions";

type AdminSidebarProps = {
  pendingOrders: number;
  adminEmail: string;
};

const navigation = [
  { href: "/admin", label: "Visão geral", icon: LayoutDashboard },
  { href: "/admin/pedidos", label: "Pedidos", icon: ClipboardList },
  { href: "/admin/produtos", label: "Produtos", icon: Box },
  { href: "/admin/categorias", label: "Categorias", icon: Tags },
  { href: "/admin/cupons", label: "Cupons parceiros", icon: TicketPercent },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/configuracoes", label: "Configurações", icon: Settings },
] as const;

export function AdminSidebar({ pendingOrders, adminEmail }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-header">
        <Link className="wordmark" href="/">ziack<span>.</span></Link>
        <form action={logoutAction}>
          <button className="admin-logout" type="submit"><LogOut size={15} /><span>Sair</span></button>
        </form>
      </div>
      <p className="admin-label">PAINEL DA LOJA</p>
      <nav aria-label="Navegação administrativa">
        {navigation.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));
          return (
            <Link className={active ? "admin-nav active" : "admin-nav"} href={href} key={href} aria-current={active ? "page" : undefined}>
              <Icon size={17} />
              {label}
              {href === "/admin/pedidos" && pendingOrders > 0 && <span className="nav-count">{pendingOrders}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="admin-user">
        <span className="user-avatar">Z</span>
        <div><strong>Equipe Ziack</strong><small>{adminEmail}</small></div>
      </div>
    </aside>
  );
}
