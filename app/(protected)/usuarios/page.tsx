import { redirect } from "next/navigation";
import { getUserRole } from "@/lib/get-user-role";
import UsuariosClient from "./usuarios-client";

export default async function UsuariosPage() {
  const role = await getUserRole();

  if (role !== "admin") {
    redirect("/dashboard");
  }

  return <UsuariosClient />;
}