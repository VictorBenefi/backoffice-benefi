import { redirect } from "next/navigation";
import { getUserRole } from "@/lib/get-user-role";
import { getUserPermissions } from "@/lib/get-user-permissions";
import PosClient from "./pos-client";

export default async function PosPage() {
  const role = await getUserRole();
  const permissions = await getUserPermissions();

  const allowedRoles = [
    "admin",
    "operaciones",
    "supervisor",
    "vendedor",
    "soporte",
  ];

  if (!role || !allowedRoles.includes(role)) {
    redirect("/dashboard");
  }

  return <PosClient canDeletePos={permissions?.can_delete_pos ?? false} />;
}