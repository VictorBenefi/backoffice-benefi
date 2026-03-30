"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      alert("Usuario o contraseña incorrectos");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      await supabase.auth.signOut();
      alert("No se pudo validar el usuario.");
      return;
    }

    const userEmail = user.email.trim().toLowerCase();

    const { data: appUsers, error: appUserError } = await supabase
      .from("app_users")
      .select("id, email, is_active, must_change_password, role")
      .eq("email", userEmail)
      .limit(1);

    if (appUserError) {
      await supabase.auth.signOut();
      alert("No se pudo validar el estado del usuario.");
      return;
    }

    const appUser = appUsers?.[0];

    if (!appUser || appUser.is_active === false) {
      await supabase.auth.signOut();
      alert("Tu usuario se encuentra inactivo.");
      return;
    }

    if (appUser.must_change_password) {
      router.push("/cambiar-clave");
      return;
    }

    router.push("/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-md space-y-4"
      >
        <h1 className="text-2xl font-bold text-center">BENEFI</h1>
        <p className="text-sm text-gray-500 text-center">
          Ingresá al BackOffice
        </p>

        <input
          type="email"
          placeholder="Email"
          className="w-full rounded-md border px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Contraseña"
          className="w-full rounded-md border px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          type="submit"
          className="w-full rounded-md bg-black px-4 py-2 text-white"
        >
          Ingresar
        </button>
      </form>
    </div>
  );
}