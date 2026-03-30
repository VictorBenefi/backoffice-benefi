"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function CambiarClavePage() {
  const supabase = createClient();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password.trim()) {
      alert("Debés ingresar una nueva contraseña.");
      return;
    }

    if (password.length < 6) {
      alert("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      alert("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id || !user?.email) {
        alert("No se pudo identificar el usuario.");
        setLoading(false);
        return;
      }

      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          password,
        }),
      });

      const contentType = response.headers.get("content-type") || "";
      let result: any = null;

      if (contentType.includes("application/json")) {
        result = await response.json();
      } else {
        const text = await response.text();
        console.error("Respuesta no JSON:", text);
        throw new Error(
          "La API no respondió JSON. Revisá app/api/auth/change-password/route.ts"
        );
      }

      if (!response.ok) {
        alert(result.error || "No se pudo actualizar la contraseña.");
        setLoading(false);
        return;
      }

      alert("Contraseña actualizada correctamente.");
      router.push("/dashboard");
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Ocurrió un error al cambiar la contraseña.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <form
        onSubmit={handleChangePassword}
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-md space-y-4"
      >
        <h1 className="text-2xl font-bold text-center">Cambiar contraseña</h1>
        <p className="text-sm text-gray-500 text-center">
          Debés cambiar tu contraseña antes de continuar
        </p>

        <input
          type="password"
          placeholder="Nueva contraseña"
          className="w-full rounded-md border px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <input
          type="password"
          placeholder="Confirmar nueva contraseña"
          className="w-full rounded-md border px-3 py-2"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-black px-4 py-2 text-white"
        >
          {loading ? "Actualizando..." : "Guardar nueva contraseña"}
        </button>
      </form>
    </div>
  );
}