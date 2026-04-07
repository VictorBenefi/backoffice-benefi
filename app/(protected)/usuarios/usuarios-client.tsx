"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AppUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
};

export default function UsuariosClient() {
  const supabase = createClient();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("vendedor");

  const [showPassword, setShowPassword] = useState(false);

  // RESET PASSWORD
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetUser, setResetUser] = useState<AppUser | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);

    const { data } = await supabase.from("app_users").select("*").order("name");

    if (data) setUsers(data);

    setLoading(false);
  }

  async function createUser() {
    if (!name || !email || !password) {
      alert("Completar todos los campos");
      return;
    }

    const res = await fetch("/api/admin/create-user", {
      method: "POST",
      body: JSON.stringify({
        name,
        email,
        password,
        role,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      alert(result.error || "Error al crear usuario");
      return;
    }

    setName("");
    setEmail("");
    setPassword("");

    fetchUsers();
  }

  async function updateRole(user: AppUser, newRole: string) {
    const { error } = await supabase
      .from("app_users")
      .update({ role: newRole })
      .eq("id", user.id);

    if (error) {
      alert("Error al actualizar rol");
      return;
    }

    fetchUsers();
  }

  async function toggleActive(user: AppUser) {
    const nextValue = !user.is_active;

    const { error } = await supabase
      .from("app_users")
      .update({ is_active: nextValue })
      .eq("id", user.id);

    if (error) {
      alert("Error al actualizar estado");
      return;
    }

    fetchUsers();
  }

  // 🔥 FIX ERROR BUILD (FUNCIONES QUE FALTABAN)
  function openResetModal(user: AppUser) {
    setResetUser(user);
    setResetPasswordValue("");
    setResetConfirmPassword("");
    setShowResetPassword(false);
    setShowResetModal(true);
  }

  function closeResetModal() {
    if (resetLoading) return;
    setShowResetModal(false);
    setResetUser(null);
    setResetPasswordValue("");
    setResetConfirmPassword("");
    setShowResetPassword(false);
  }

  async function resetPassword() {
    if (!resetUser) return;

    if (!resetPasswordValue || !resetConfirmPassword) {
      alert("Completar contraseña");
      return;
    }

    if (resetPasswordValue !== resetConfirmPassword) {
      alert("Las contraseñas no coinciden");
      return;
    }

    setResetLoading(true);

    const res = await fetch("/api/admin/reset-password", {
      method: "POST",
      body: JSON.stringify({
        userId: resetUser.id,
        password: resetPasswordValue,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      alert(result.error || "Error al resetear contraseña");
      setResetLoading(false);
      return;
    }

    setResetLoading(false);
    closeResetModal();
  }

  return (
    <div className="p-4 space-y-6 overflow-auto max-h-[calc(100vh-80px)]">
      <h1 className="text-xl font-bold">Usuarios y roles</h1>

      {/* FORM */}
      <div className="border rounded p-4 space-y-3">
        <h2 className="font-semibold">Alta de usuario</h2>

        <input
          placeholder="Nombre completo"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border p-2 w-full"
        />

        <input
          placeholder="email@ejemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border p-2 w-full"
        />

        <div className="flex gap-2">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Contraseña inicial"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border p-2 w-full"
          />
          <button onClick={() => setShowPassword(!showPassword)}>Ver</button>
        </div>

        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="border p-2"
        >
          <option value="admin">admin</option>
          <option value="supervisor">supervisor</option>
          <option value="operaciones">operaciones</option>
          <option value="soporte">soporte</option>
          <option value="vendedor">vendedor</option>
        </select>

        <button onClick={createUser} className="bg-black text-white px-4 py-2">
          Crear usuario
        </button>
      </div>

      {/* LISTADO */}
      <div className="border rounded p-4">
        <h2 className="font-semibold mb-3">Usuarios existentes</h2>

        <div className="max-h-[400px] overflow-auto">
          {users.map((u) => (
            <div
              key={u.id}
              className="flex justify-between items-center border-b py-2"
            >
              <div>
                <div>{u.name}</div>
                <div className="text-sm text-gray-500">{u.email}</div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={u.role}
                  onChange={(e) => updateRole(u, e.target.value)}
                  className="border p-1"
                >
                  <option value="admin">admin</option>
                  <option value="supervisor">supervisor</option>
                  <option value="operaciones">operaciones</option>
                  <option value="soporte">soporte</option>
                  <option value="vendedor">vendedor</option>
                </select>

                <button
                  onClick={() => toggleActive(u)}
                  className="bg-red-500 text-white px-2 py-1"
                >
                  {u.is_active ? "Inactivar" : "Activar"}
                </button>

                <button
                  onClick={() => openResetModal(u)}
                  className="bg-blue-600 text-white px-2 py-1"
                >
                  Reset
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL RESET */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-6 rounded w-[350px] space-y-3">
            <h3 className="font-bold">Reset contraseña</h3>

            <input
              type={showResetPassword ? "text" : "password"}
              placeholder="Nueva contraseña"
              value={resetPasswordValue}
              onChange={(e) => setResetPasswordValue(e.target.value)}
              className="border p-2 w-full"
            />

            <input
              type={showResetPassword ? "text" : "password"}
              placeholder="Confirmar contraseña"
              value={resetConfirmPassword}
              onChange={(e) => setResetConfirmPassword(e.target.value)}
              className="border p-2 w-full"
            />

            <button onClick={() => setShowResetPassword(!showResetPassword)}>
              Ver contraseña
            </button>

            <div className="flex justify-end gap-2">
              <button onClick={closeResetModal}>Cancelar</button>
              <button
                onClick={resetPassword}
                className="bg-blue-600 text-white px-3 py-1"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}