import { redirect } from "next/navigation";
import { getUserRole } from "@/lib/get-user-role";
import IncidenciasClient from "./incidencias-client";

export default async function IncidenciasPage() {
  const role = await getUserRole();

  if (!["admin", "soporte", "supervisor"].includes(role || "")) {
    redirect("/dashboard");
  }

  return <IncidenciasClient />;
}