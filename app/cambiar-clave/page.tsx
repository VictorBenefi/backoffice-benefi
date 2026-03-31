"use client";

import { useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";

export default function CambiarClavePage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const userId = useMemo(() => searchParams.get("userId") || "", [searchParams]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId) {
      toast.error("Falta el identificador del usuario.");
      return;
    }

    if (!password || !confirmPassword) {
      toast.warning("Todos los campos son obligatorios.");
      return;
    }

    if (password.length < 6) {
      toast.warning("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          password,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(data?.error || "Error al actualizar la contraseña.");
        return;
      }

      toast.success(data?.message || "Contraseña actualizada correctamente.");

      setPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        router.push("/usuarios");
      }, 1200);
    } catch (error: any) {
      console.error("Error al cambiar contraseña:", error);
      toast.error(error?.message || "Error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <form
        onSubmit={handleChangePassword}
        className="w-full max-w-md rounded-xl bg-white p-7 shadow-md"
      >
        <h2 className="mb-5 text-3xl font-bold text-gray-900">
          Cambiar contraseña
        </h2>

        <div className="space-y-4">
          <input
            type="password"
            placeholder="Nueva contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-4 py-3 outline-none transition focus:border-red-600"
            disabled={loading}
          />

          <input
            type="password"
            placeholder="Confirmar contraseña"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-4 py-3 outline-none transition focus:border-red-600"
            disabled={loading}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-red-600 px-4 py-3 text-lg font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Actualizando..." : "Actualizar contraseña"}
          </button>
        </div>
      </form>
    </div>
  );
}