"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AppUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  is_active: boolean | null;
};

const initialForm = {
  name: "",
  email: "",
  password: "",
  role: "operaciones",
};

export default function UsuariosClient() {
  const supabase = createClient();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [formData, setFormData] = useState(initialForm);
  const [showPassword, setShowPassword] = useState(false);

  const roles = ["admin", "operaciones", "supervisor", "vendedor", "soporte"];

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);

    const { data, error } = await supabase
      .from("app_users")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      alert(`Error cargando usuarios: ${error.message}`);
      setUsers([]);
      setLoading(false);
      return;
    }

    setUsers(data || []);
    setLoading(false);
  }

  async function updateRole(id: string, role: string) {
    setSavingId(id);

    const { error } = await supabase
      .from("app_users")
      .update({ role })
      .eq("id", id);

    setSavingId(null);

    if (error) {
      alert(`Error actualizando rol: ${error.message}`);
      return;
    }

    await fetchUsers();
  }

  async function toggleActive(user: AppUser) {
    const nextValue = !user.is_active;

    setSavingId(user.id);

    const { error } = await supabase
      .from("app_users")
      .update({ is_active: nextValue })
      .eq("id", user.id);

    setSavingId(null);

    if (error) {
      alert(`Error actualizando estado: ${error.message}`);
      return;
    }

    await fetchUsers();
  }

  // 🔐 RESET PASSWORD
  async function resetPassword(user: AppUser) {
    const newPassword = prompt(
      `Ingresá nueva contraseña para ${user.email}`
    );

    if (!newPassword) return;

    if (newPassword.length < 6) {
      alert("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    try {
      const response = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          password: newPassword,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.error || "No se pudo actualizar la contraseña.");
        return;
      }

      alert("Contraseña actualizada correctamente.");
    } catch (error) {
      console.error(error);
      alert("Error al actualizar contraseña.");
    }
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert("Debés ingresar el nombre.");
      return;
    }

    if (!formData.email.trim()) {
      alert("Debés ingresar el email.");
      return;
    }

    if (!formData.password.trim()) {
      alert("Debés ingresar la contraseña inicial.");
      return;
    }

    setCreating(true);

    try {
      const response = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          role: formData.role,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.error || "No se pudo crear el usuario.");
        setCreating(false);
        return;
      }

      alert("Usuario creado correctamente.");
      setFormData(initialForm);
      setShowPassword(false);
      await fetchUsers();
    } catch (error) {
      console.error(error);
      alert("Ocurrió un error al crear el usuario.");
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <p>Cargando usuarios...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Usuarios y roles</h1>

      {/* Alta de usuario */}
      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <h2 className="text-xl font-semibold mb-4">Alta de usuario</h2>

        <form onSubmit={createUser} className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm mb-1">Nombre</label>
            <input
              type="text"
              className="w-full rounded-lg border px-3 py-2"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Nombre completo"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Email / Usuario</label>
            <input
              type="email"
              className="w-full rounded-lg border px-3 py-2"
              value={formData.email}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, email: e.target.value }))
              }
              placeholder="usuario@empresa.com"
            />
          </div>

          {/* CONTRASEÑA */}
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Contraseña inicial</label>

            <div className="flex gap-2">
              <input
                type={showPassword ? "text" : "password"}
                className="w-full rounded-lg border px-3 py-2"
                value={formData.password}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    password: e.target.value,
                  }))
                }
                placeholder="Contraseña inicial"
              />

              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                {showPassword ? "Ocultar" : "Ver"}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1">Rol</label>
            <select
              className="w-full rounded-lg border px-3 py-2"
              value={formData.role}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, role: e.target.value }))
              }
            >
              {roles.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={creating}
              className="bg-black text-white px-4 py-2 rounded-lg"
            >
              {creating ? "Creando..." : "Crear usuario"}
            </button>
          </div>
        </form>
      </div>

      {/* Lista de usuarios */}
      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <h2 className="text-xl font-semibold mb-4">Usuarios existentes</h2>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="pb-3">Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>

          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b">
                <td className="py-3">{user.name || "-"}</td>
                <td>{user.email || "-"}</td>

                <td>
                  <select
                    className="border rounded-lg px-2 py-1"
                    value={user.role || ""}
                    onChange={(e) => {
                      const newRole = e.target.value;

                      setUsers((prev) =>
                        prev.map((u) =>
                          u.id === user.id ? { ...u, role: newRole } : u
                        )
                      );
                    }}
                  >
                    {roles.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </td>

                <td>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                      user.is_active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {user.is_active ? "Activo" : "Inactivo"}
                  </span>
                </td>

                <td>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => updateRole(user.id, user.role || "")}
                      disabled={savingId === user.id}
                      className="bg-black text-white px-3 py-1 rounded-lg"
                    >
                      Guardar rol
                    </button>

                    <button
                      onClick={() => toggleActive(user)}
                      disabled={savingId === user.id}
                      className={`px-3 py-1 rounded-lg text-white ${
                        user.is_active ? "bg-red-600" : "bg-emerald-600"
                      }`}
                    >
                      {user.is_active ? "Inactivar" : "Reactivar"}
                    </button>

                    <button
                      onClick={() => resetPassword(user)}
                      className="px-3 py-1 rounded-lg bg-blue-600 text-white"
                    >
                      Reset clave
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}