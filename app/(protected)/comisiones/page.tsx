import { redirect } from "next/navigation";
import { getUserRole } from "@/lib/get-user-role";
import ComisionesClient from "./comisiones-client";

export default async function ComisionesPage() {
  const role = await getUserRole();

  if (!["admin", "supervisor"].includes(role || "")) {
    redirect("/dashboard");
  }

  return <ComisionesClient />;
}