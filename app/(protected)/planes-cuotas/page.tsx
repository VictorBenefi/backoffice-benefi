import { redirect } from "next/navigation";
import { getUserRole } from "@/lib/get-user-role";
import PlanesCuotasClient from "./planes-cuotas-client";

export default async function PlanesCuotasPage() {
  const role = await getUserRole();

  if (!["admin", "supervisor"].includes(role || "")) {
    redirect("/dashboard");
  }

  return <PlanesCuotasClient />;
}