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
      toast.warning("Debés ingresar la contraseña.");
      return;
    }

    if (formData.password.length < 6) {
      toast.warning("Mínimo 6 caracteres.");
      return;
    }

    setCreating(true);

    try {
      const response = await fetch("/api/admin/create-user", {
        method: "POST",
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        toast.error("Error creando usuario");
        return;
      }

      toast.success("Usuario creado correctamente");
      setFormData(initialForm);
      setShowPassword(false);
      await fetchUsers();
    } catch (error) {
      toast.error("Error inesperado");
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <p>Cargando usuarios...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Usuarios y roles</h1>

      {/* ALTA */}
      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <h2 className="text-xl font-semibold mb-4">Alta de usuario</h2>

        <form onSubmit={createUser} className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm">Nombre</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Ej: Juan Pérez"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
          </div>

          <div>
            <label className="text-sm">Email</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Ej: usuario@empresa.com"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm">Contraseña</label>
            <div className="flex gap-2">
              <input
                type={showPassword ? "text" : "password"}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Ej: 123456"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="border px-3 rounded-lg"
              >
                {showPassword ? "Ocultar" : "Ver"}
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm">Rol</label>
            <select
              className="w-full border rounded-lg px-3 py-2"
              value={formData.role}
              onChange={(e) =>
                setFormData({ ...formData, role: e.target.value })
              }
            >
              {roles.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <button className="bg-black text-white px-4 py-2 rounded-lg">
              {creating ? "Creando..." : "Crear usuario"}
            </button>
          </div>
        </form>
      </div>

      {/* LISTADO */}
      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <h2 className="text-xl font-semibold mb-4">Usuarios existentes</h2>

        <div className="max-h-[400px] overflow-y-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b">
                <th className="p-2 text-left">Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>

            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b">
                  <td className="p-2">{user.name}</td>
                  <td>{user.email}</td>

                  <td>
                    <select
                      className="border px-2 py-1 rounded"
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
                      className={`px-2 py-1 rounded text-xs ${
                        user.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {user.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </td>

                  <td className="flex gap-2 p-2 flex-wrap">
                    <button
                      onClick={() => updateRole(user.id, user.role || "")}
                      className="bg-black text-white px-2 py-1 rounded"
                    >
                      Guardar
                    </button>

                    <button
                      onClick={() => toggleActive(user)}
                      className="bg-red-600 text-white px-2 py-1 rounded"
                    >
                      {user.is_active ? "Inactivar" : "Activar"}
                    </button>

                    <button
                      onClick={() => openResetModal(user)}
                      className="bg-blue-600 text-white px-2 py-1 rounded"
                    >
                      Reset
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}