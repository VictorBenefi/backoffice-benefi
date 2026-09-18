import { redirect } from "next/navigation";
import { getUserRole } from "@/lib/get-user-role";
import ComisionesPartnersClient from "./comisiones-partners-client";

export default async function ComisionesPartnersPage() {
  const role = await getUserRole();

  if (role !== "admin") {
    redirect("/dashboard");
  }

  return <ComisionesPartnersClient />;
}