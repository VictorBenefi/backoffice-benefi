import { redirect } from "next/navigation";
import { getUserRole } from "@/lib/get-user-role";
import InstalacionesClient from "./instalaciones-client";

export default async function InstalacionesPage() {
  const role = await getUserRole();

  if (!["admin", "soporte", "supervisor"].includes(role || "")) {
    redirect("/dashboard");
  }

  return <InstalacionesClient />;
}