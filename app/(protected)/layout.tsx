import Link from "next/link";
import Image from "next/image";
import LogoutButton from "@/components/logout-button";
import { getUserRole } from "@/lib/get-user-role";

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
      href: "/usuarios",
      label: "Usuarios",
      roles: ["admin"],
    },
  ];

  const filteredMenu = menu.filter((item) =>
    item.roles.includes(role || "")
  );

  return (
    <div className="flex min-h-screen bg-gray-100">
      <aside className="w-72 min-w-[280px] bg-[#050816] text-white flex flex-col justify-between">
        <div>
          <div className="px-6 py-6 border-b border-slate-800">
            <Image
              src="/logo-benefi.png"
              alt="Benefi"
              width={150}
              height={45}
              className="object-contain"
            />

            <p className="text-xs text-slate-400 mt-2">
              BackOffice operativo
            </p>

            {role && (
              <span className="inline-block mt-3 text-xs bg-slate-800 px-3 py-1 rounded-full">
                Rol: {role}
              </span>
            )}
          </div>

          <nav className="px-4 py-4 space-y-2">
            {filteredMenu.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block px-3 py-2 rounded-md text-sm hover:bg-slate-800 transition whitespace-nowrap overflow-hidden text-ellipsis"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="px-6 py-6 border-t border-slate-800">
          <div className="flex justify-center mb-4">
            <Image
              src="/isotipo-benefi.png"
              alt="Benefi isotipo"
              width={42}
              height={42}
              className="object-contain opacity-90"
            />
          </div>

          <LogoutButton />

          <p className="mt-3 text-center text-xs text-slate-500">
            Sistema interno BENEFI
          </p>
        </div>
      </aside>

      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}