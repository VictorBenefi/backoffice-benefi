"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

type AppUser = {
  id: string;
  auth_user_id: string | null;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    if (!resetUser.auth_user_id) {
      toast.error("Este usuario no tiene auth_user_id vinculado.");
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
          userId: resetUser.auth_user_id,
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
      await fetchUsers();
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

    const activeSameEmail = users.find(
      (u) =>
        (u.email || "").trim().toLowerCase() ===
          formData.email.trim().toLowerCase() && u.is_active
    );

    if (activeSameEmail) {
      toast.error(
        "Ya existe un usuario activo con ese correo. Inactivalo antes de crear otro."
      );
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
      <div className="flex h-[calc(100vh-140px)] flex-col gap-6 overflow-hidden">
        <h1 className="shrink-0 text-3xl font-bold">Usuarios y roles</h1>

        <div className="shrink-0 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">Alta de usuario</h2>

          <form
            onSubmit={createUser}
            autoComplete="off"
            className="grid gap-4 md:grid-cols-2"
          >
            <div>
              <label className="mb-1 block text-sm">Nombre</label>
              <input
                type="text"
                className="w-full rounded-lg border px-3 py-2"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Ej: Juan Pérez"
                autoComplete="off"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm">Email / Usuario</label>
              <input
                type="email"
                className="w-full rounded-lg border px-3 py-2"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="Ej: usuario@empresa.com"
                autoComplete="new-email"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm">Contraseña inicial</label>

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
                  placeholder="Ingresar contraseña inicial"
                  autoComplete="new-password"
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
              <label className="mb-1 block text-sm">Rol</label>
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
                className="rounded-lg bg-black px-4 py-2 text-white"
              >
                {creating ? "Creando..." : "Crear usuario"}
              </button>
            </div>
          </form>
        </div>

        <div className="flex min-h-0 flex-1 flex-col rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 shrink-0 text-xl font-semibold">
            Usuarios existentes
          </h2>

          <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b">
                  <th className="pb-3 pl-3 pt-3 text-left">Nombre</th>
                  <th className="text-left">Email</th>
                  <th className="text-left">Rol</th>
                  <th className="text-left">Estado</th>
                  <th className="text-left">Acción</th>
                </tr>
              </thead>

              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b">
                    <td className="py-3 pl-3">{user.name || "-"}</td>
                    <td>{user.email || "-"}</td>

                    <td>
                      <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {user.role || "-"}
                      </span>
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
                      <div className="flex flex-wrap gap-2 py-2 pr-3">
                        <button
                          onClick={() => toggleActive(user)}
                          disabled={savingId === user.id}
                          className={`rounded-lg px-3 py-1 text-white ${
                            user.is_active ? "bg-red-600" : "bg-emerald-600"
                          }`}
                        >
                          {user.is_active ? "Inactivar" : "Reactivar"}
                        </button>

                        <button
                          onClick={() => openResetModal(user)}
                          className="rounded-lg bg-blue-600 px-3 py-1 text-white"
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

          <p className="mt-3 shrink-0 text-xs text-slate-500">
            El rol se define al crear el usuario. Si una persona cambia de
            función, se recomienda inactivar el usuario actual y crear uno nuevo
            con el rol correspondiente.
          </p>
        </div>
      </div>

      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-xl font-semibold text-gray-900">
              Resetear contraseña
            </h3>

            <p className="mt-2 text-sm text-gray-600">
              Usuario:{" "}
              <span className="font-medium">{resetUser?.email || "-"}</span>
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
                  autoComplete="new-password"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm">
                  Confirmar contraseña
                </label>
                <input
                  type={showResetPassword ? "text" : "password"}
                  className="w-full rounded-lg border px-3 py-2"
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                  placeholder="Confirmá la contraseña"
                  disabled={resetLoading}
                  autoComplete="new-password"
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