"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

type Vendor = {
  id: string;
  auth_user_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  zone: string | null;
  created_at: string;
};

type VendorUserOption = {
  auth_user_id: string | null;
  name: string | null;
  email: string | null;
};

const initialForm = {
  name: "",
  email: "",
  phone: "",
  zone: "",
  auth_user_id: "",
};

export default function VendedoresPage() {
  const supabase = createClient();

  const [formData, setFormData] = useState(initialForm);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorUsers, setVendorUsers] = useState<VendorUserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const loadVendors = async () => {
    const { data, error } = await supabase
      .from("vendors")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error al cargar vendedores:", error.message);
      toast.error(`Error al cargar vendedores: ${error.message}`);
      return;
    }

    setVendors((data as Vendor[]) || []);
  };

  const loadVendorUsers = async () => {
    setLoadingUsers(true);

    const { data, error } = await supabase
      .from("app_users")
      .select("auth_user_id, name, email, role")
      .eq("role", "vendedor")
      .order("name", { ascending: true });

    setLoadingUsers(false);

    if (error) {
      console.error("Error al cargar usuarios vendedor:", error.message);
      toast.error(`Error al cargar usuarios vendedor: ${error.message}`);
      return;
    }

    const onlyValidUsers =
      data
        ?.filter((user) => !!user.auth_user_id)
        .map((user) => ({
          auth_user_id: user.auth_user_id as string,
          name: user.name as string | null,
          email: user.email as string | null,
        })) || [];

    setVendorUsers(onlyValidUsers);
  };

  useEffect(() => {
    loadVendors();
    loadVendorUsers();
  }, []);

  const handleChange = (
    field: keyof typeof initialForm,
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const resetForm = () => {
    setFormData(initialForm);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.warning("Debés ingresar el nombre del vendedor.");
      return;
    }

    setLoading(true);

    const payload = {
      name: formData.name.trim(),
      email: formData.email.trim() || null,
      phone: formData.phone.trim() || null,
      zone: formData.zone.trim() || null,
      auth_user_id: formData.auth_user_id || null,
    };

    if (editingId) {
      const { error } = await supabase
        .from("vendors")
        .update(payload)
        .eq("id", editingId);

      setLoading(false);

      if (error) {
        toast.error(`Error al editar vendedor: ${error.message}`);
        console.error(error);
        return;
      }

      toast.success("Vendedor actualizado correctamente.");
      resetForm();
      await loadVendors();
      return;
    }

    const { error } = await supabase.from("vendors").insert([payload]);

    setLoading(false);

    if (error) {
      toast.error(`Error al guardar vendedor: ${error.message}`);
      console.error(error);
      return;
    }

    toast.success("Vendedor creado correctamente.");
    resetForm();
    await loadVendors();
  };

  const handleEdit = (vendor: Vendor) => {
    setEditingId(vendor.id);
    setFormData({
      name: vendor.name || "",
      email: vendor.email || "",
      phone: vendor.phone || "",
      zone: vendor.zone || "",
      auth_user_id: vendor.auth_user_id || "",
    });
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm(
      "¿Seguro que querés eliminar este vendedor?"
    );

    if (!confirmed) return;

    const { error } = await supabase.from("vendors").delete().eq("id", id);

    if (error) {
      toast.error(`Error al eliminar vendedor: ${error.message}`);
      console.error(error);
      return;
    }

    toast.success("Vendedor eliminado correctamente.");

    if (editingId === id) {
      resetForm();
    }

    await loadVendors();
  };

  const filteredVendors = useMemo(() => {
    const text = search.trim().toLowerCase();

    return vendors.filter((vendor) => {
      if (!text) return true;

      return (
        (vendor.name || "").toLowerCase().includes(text) ||
        (vendor.email || "").toLowerCase().includes(text) ||
        (vendor.phone || "").toLowerCase().includes(text) ||
        (vendor.zone || "").toLowerCase().includes(text)
      );
    });
  }, [vendors, search]);

  const getAssignedUserLabel = (authUserId: string | null) => {
    if (!authUserId) return "Sin usuario asignado";

    const match = vendorUsers.find(
      (user) => user.auth_user_id === authUserId
    );

    if (!match) return "Usuario no encontrado";

    return `${match.name || "Sin nombre"}${match.email ? ` (${match.email})` : ""}`;
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <h1 className="mb-6 text-3xl font-bold">Vendedores</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold">
            {editingId ? "Editar vendedor" : "Nuevo vendedor"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm">Nombre</label>
              <input
                type="text"
                className="w-full rounded-md border px-3 py-2"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Ej: Juan Pérez"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm">Email</label>
              <input
                type="email"
                className="w-full rounded-md border px-3 py-2"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="Ej: juan@email.com"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm">Teléfono</label>
              <input
                type="text"
                className="w-full rounded-md border px-3 py-2"
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="Ej: 387..."
              />
            </div>

            <div>
              <label className="mb-1 block text-sm">Zona</label>
              <input
                type="text"
                className="w-full rounded-md border px-3 py-2"
                value={formData.zone}
                onChange={(e) => handleChange("zone", e.target.value)}
                placeholder="Ej: Salta Centro"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm">
                Usuario del sistema asignado
              </label>
              <select
                className="w-full rounded-md border px-3 py-2"
                value={formData.auth_user_id}
                onChange={(e) =>
                  handleChange("auth_user_id", e.target.value)
                }
                disabled={loadingUsers}
              >
                <option value="">
                  {loadingUsers
                    ? "Cargando usuarios..."
                    : "Sin usuario asignado"}
                </option>
                {vendorUsers.map((user) => (
                  <option
                    key={user.auth_user_id}
                    value={user.auth_user_id || ""}
                  >
                    {user.name || "Sin nombre"}
                    {user.email ? ` (${user.email})` : ""}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Solo los usuarios con rol vendedor aparecen en esta lista.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-black px-4 py-2 text-white"
              >
                {loading
                  ? "Guardando..."
                  : editingId
                  ? "Actualizar vendedor"
                  : "Guardar vendedor"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-md border px-4 py-2"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="flex flex-col rounded-xl bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Listado</h2>
              <p className="text-sm text-slate-500">
                {filteredVendors.length} de {vendors.length} vendedores
              </p>
            </div>
          </div>

          <div className="mb-4 flex gap-2">
            <input
              type="text"
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, email, teléfono o zona..."
            />

            <button
              type="button"
              onClick={() => setSearch("")}
              className="whitespace-nowrap rounded-md border px-3 py-2 text-sm"
            >
              Limpiar
            </button>
          </div>

          {filteredVendors.length === 0 ? (
            <p className="text-gray-500">
              {vendors.length === 0
                ? "No hay vendedores cargados."
                : "No se encontraron vendedores con esa búsqueda."}
            </p>
          ) : (
            <div className="max-h-[600px] flex-1 space-y-2 overflow-auto pr-2">
              {filteredVendors.map((vendor) => (
                <div
                  key={vendor.id}
                  className="flex flex-col gap-1 rounded-lg border p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold">
                      {vendor.name || "Sin nombre"}
                    </p>

                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => handleEdit(vendor)}
                        className="rounded-md bg-blue-600 px-2 py-1 text-xs text-white"
                      >
                        Editar
                      </button>

                      <button
                        onClick={() => handleDelete(vendor.id)}
                        className="rounded-md bg-red-600 px-2 py-1 text-xs text-white"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>

                  <div className="text-xs text-gray-600">
                    <p>Email: {vendor.email || "-"}</p>
                    <p>Tel: {vendor.phone || "-"}</p>
                    <p>Zona: {vendor.zone || "-"}</p>
                    <p>Usuario asignado: {getAssignedUserLabel(vendor.auth_user_id)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}