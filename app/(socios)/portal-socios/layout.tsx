
import { redirect } from "next/navigation";
import { getUserRole } from "@/lib/get-user-role";
import ResponsiveProtectedShell from "@/components/responsive-protected-shell";

export default async function SociosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await getUserRole();

  if (!role) {
    redirect("/login");
  }

  if (role !== "socio") {
    redirect(
      role === "merchant"
        ? "/portal-comercio"
        : "/dashboard"
    );
  }

  const menu = [
    {
      href: "/portal-socios",
      label: "Dashboard",
    },
    {
      href: "/portal-socios/operaciones",
      label: "Operaciones",
    },
    {
      href: "/portal-socios/resultados",
      label: "Resultados mensuales",
    },
  ];

  return (
    <ResponsiveProtectedShell
      role={role}
      menu={menu}
    >
      {children}
    </ResponsiveProtectedShell>
  );
}
