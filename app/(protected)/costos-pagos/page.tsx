import { redirect } from "next/navigation";
import { getUserRole } from "@/lib/get-user-role";
import CostosPagosClient from "./costos-pagos-client";

export default async function CostosPagosPage() {
  const role = await getUserRole();

  if (role !== "admin") {
    redirect("/dashboard");
  }

  return <CostosPagosClient />;
}
