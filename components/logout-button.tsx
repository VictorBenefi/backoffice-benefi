"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const supabase = createClient();

  const [isLoggingOut, setIsLoggingOut] =
    useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      const { error } =
        await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      window.location.replace("/login");
    } catch (error) {
      console.error(
        "Error cerrando sesión:",
        error
      );

      setIsLoggingOut(false);

      alert(
        "No se pudo cerrar la sesión. Intentá nuevamente."
      );
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoggingOut}
      className="w-full rounded-xl border border-slate-700 px-4 py-3 text-left text-sm font-medium text-slate-200 transition hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isLoggingOut
        ? "Cerrando sesión..."
        : "Cerrar sesión"}
    </button>
  );
}