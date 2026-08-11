import { redirect } from "next/navigation";
import { getUserRole } from "@/lib/get-user-role";
import ExportacionesMentaClient from "./exportaciones-menta-client";

export default async function ExportacionesMentaPage() {
  const role = await getUserRole();

  if (!["admin", "supervisor", "operaciones"].includes(role || "")) {
    redirect("/dashboard");
  }

  return <ExportacionesMentaClient />;
}