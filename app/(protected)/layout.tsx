import { getUserRole } from "@/lib/get-user-role";
import ResponsiveProtectedShell from "@/components/responsive-protected-shell";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await getUserRole();

  const menu = [
    {
      href: "/dashboard",
      label: "Dashboard",
      roles: ["admin", "supervisor", "operaciones", "soporte", "vendedor"],
    },
    {
      href: "/mis-comisiones",
      label: "Mis comisiones",
      roles: ["vendedor"],
    },
    {
      href: "/vendedores",
      label: "Vendedores",
      roles: ["admin", "supervisor"],
    },
    {
      href: "/comercios",
      label: "Comercios",
      roles: ["admin", "supervisor", "operaciones", "vendedor"],
    },
    {
      href: "/pos",
      label: "POS",
      roles: ["admin", "supervisor", "operaciones", "soporte", "vendedor"],
    },
    {
      href: "/pos/importar",
      label: "Importar POS",
      roles: ["admin", "operaciones"],
    },
    {
      href: "/movimientos",
      label: "Movimientos",
      roles: ["admin", "supervisor", "operaciones", "vendedor"],
    },
    {
      href: "/asignaciones",
      label: "Asignaciones",
      roles: ["admin", "supervisor", "operaciones"],
    },
    {
      href: "/instalaciones",
      label: "Instalaciones",
      roles: ["admin", "supervisor", "operaciones"],
    },
    {
      href: "/incidencias",
      label: "Incidencias / Soporte",
      roles: ["admin", "soporte", "supervisor", "operaciones"],
    },
    {
      href: "/comisiones",
      label: "Config. Comisiones",
      roles: ["admin", "supervisor"],
    },
    {
      href: "/liquidaciones-comisiones",
      label: "Liquidación comisiones",
      roles: ["admin", "supervisor"],
    },

    {
      href: "/planes-cuotas",
      label: "Config. planes de cuotas",
      roles: ["admin", "supervisor"],
    },
    {
      href: "/usuarios",
      label: "Usuarios",
      roles: ["admin"],
    },
  ];

  const filteredMenu = menu
    .filter((item) => item.roles.includes(role || ""))
    .map(({ href, label }) => ({
      href,
      label,
    }));

  return (
    <ResponsiveProtectedShell role={role} menu={filteredMenu}>
      {children}
    </ResponsiveProtectedShell>
  );
}