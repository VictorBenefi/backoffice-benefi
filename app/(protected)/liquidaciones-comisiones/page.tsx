import { redirect } from "next/navigation";
import { getUserRole } from "@/lib/get-user-role";
import LiquidacionesComisionesClient from "./liquidaciones-comisiones-client";

export default async function LiquidacionesComisionesPage() {
  const role = await getUserRole();

  if (!["admin", "supervisor"].includes(role || "")) {
    redirect("/dashboard");
  }

  return <LiquidacionesComisionesClient />;
}