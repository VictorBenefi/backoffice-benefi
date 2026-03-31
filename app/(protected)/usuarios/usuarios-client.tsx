"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
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

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetUser, setResetUser] = useState<AppUser | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

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
      toast.error(`Error cargando usuarios: ${error.message}`);
      setUsers([]);
      setLoading(false);
      return;
    }

    setUsers((data as AppUser[]) || []);
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
      toast.error(`Error actualizando rol: ${error.message}`);
      return;
    }

    toast.success("Rol actualizado correctamente.");
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
      toast.error(`Error actualizando estado: ${error.message}`);
      return;
    }

    toast.success(
      nextValue
        ? "Usuario activado correctamente."
        : "Usuario inactivado correctamente."
    );

    await fetchUsers();
  }

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

  async function handleResetPassword() {
    if (!resetUser) {
      toast.error("No se pudo identificar el usuario.");
      return;
    }

    if (!resetPasswordValue.trim() || !resetConfirmPassword.trim()) {
      toast.warning("Debés completar ambos campos.");
      return;
    }

    if (resetPasswordValue.length < 6) {
      toast.warning("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (resetPasswordValue !== resetConfirmPassword) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }

    try {
      setResetLoading(true);

      const response = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: resetUser.id,
          password: resetPasswordValue,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        toast.error(result?.error || "No se pudo actualizar la contraseña.");
        return;
      }

      toast.success(result?.message || "Contraseña actualizada correctamente.");
      closeResetModal();
    } catch (error) {
      console.error(error);
      toast.error("Error al actualizar contraseña.");
    } finally {
      setResetLoading(false);
    }
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.warning("Debés ingresar el nombre.");
      return;
    }

    if (!formData.email.trim()) {
      toast.warning("Debés ingresar el email.");
      return;
    }

    if (!formData.password.trim()) {
      toast.warning("Debés ingresar la contraseña inicial.");
      return;
    }

    if (formData.password.trim().length < 6) {
      toast.warning("La contraseña inicial debe tener al menos 6 caracteres.");
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

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        toast.error(result?.error || "No se pudo crear el usuario.");
        setCreating(false);
        return;
      }

      toast.success("Usuario creado correctamente.");
      setFormData(initialForm);
      setShowPassword(false);
      await fetchUsers();
    } catch (error) {
      console.error(error);
      toast.error("Ocurrió un error al crear el usuario.");
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <p>Cargando usuarios...</p>;

  return (
    <>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Usuarios y roles</h1>

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
                        onClick={() => openResetModal(user)}
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

      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-xl font-semibold text-gray-900">
              Resetear contraseña
            </h3>

            <p className="mt-2 text-sm text-gray-600">
              Usuario: <span className="font-medium">{resetUser?.email || "-"}</span>
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-sm">Nueva contraseña</label>
                <input
                  type={showResetPassword ? "text" : "password"}
                  className="w-full rounded-lg border px-3 py-2"
                  value={resetPasswordValue}
                  onChange={(e) => setResetPasswordValue(e.target.value)}
                  placeholder="Ingresá nueva contraseña"
                  disabled={resetLoading}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm">Confirmar contraseña</label>
                <input
                  type={showResetPassword ? "text" : "password"}
                  className="w-full rounded-lg border px-3 py-2"
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                  placeholder="Confirmá la contraseña"
                  disabled={resetLoading}
                />
              </div>

              <button
                type="button"
                onClick={() => setShowResetPassword((prev) => !prev)}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                {showResetPassword ? "Ocultar contraseñas" : "Ver contraseñas"}
              </button>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeResetModal}
                disabled={resetLoading}
                className="rounded-lg border px-4 py-2"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleResetPassword}
                disabled={resetLoading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-70"
              >
                {resetLoading ? "Actualizando..." : "Guardar nueva clave"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}