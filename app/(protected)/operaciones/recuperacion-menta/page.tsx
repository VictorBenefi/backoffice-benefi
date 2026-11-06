
import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserRole } from "@/lib/get-user-role";
import RecoveryForm from "./recovery-form";

export default async function RecuperacionMentaPage() {
  const role = await getUserRole();

  if (role !== "admin" && role !== "supervisor") {
    redirect("/dashboard");
  }

  return (
    <main className="space-y-6 p-4 sm:p-6">
      <div>
        <Link
          href="/operaciones"
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          ← Volver a Operaciones
        </Link>

        <h1 className="mt-4 text-2xl font-bold text-slate-950">
          Recuperación de operaciones MENTA
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Herramienta administrativa para verificar operaciones
          faltantes o modificadas de MENTA.
        </p>
      </div>

      <RecoveryForm />
    </main>
  );
}
