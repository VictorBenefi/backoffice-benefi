import { redirect } from "next/navigation";
import { getUserRole } from "@/lib/get-user-role";
import ResponsiveProtectedShell from "@/components/responsive-protected-shell";

export default async function MerchantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await getUserRole();

  if (role !== "merchant") {
    redirect("/dashboard");
  }

const menu = [
  {
    href: "/portal-comercio",
    label: "Dashboard",
  },
  {
    href: "/portal-comercio/operaciones",
    label: "Operaciones",
  },
  {
    href: "/portal-comercio/liquidaciones",
    label: "Liquidaciones",
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