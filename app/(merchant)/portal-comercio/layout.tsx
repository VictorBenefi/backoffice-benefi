import { redirect } from "next/navigation";
import { getUserRole } from "@/lib/get-user-role";
import { getMerchantAccess } from "@/lib/get-merchant-access";
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
const merchantAccess =
  await getMerchantAccess();

const isPartner =
  (merchantAccess?.partnerGroupIds
    ?.length ?? 0) > 0;
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
  ...(isPartner
    ? [
        {
          href: "/portal-comercio/mis-comisiones",
          label: "Mis comisiones",
        },
      ]
    : []),
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