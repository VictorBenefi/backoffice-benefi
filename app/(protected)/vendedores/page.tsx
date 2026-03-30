"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Vendor = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  zone: string | null;
  created_at: string;
};

const initialForm = {
  name: "",
  email: "",
  phone: "",
  zone: "",
};

export default function VendedoresPage() {
  const supabase = createClient();

  const [formData, setFormData] = useState(initialForm);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const loadVendors = async () => {
    const { data, error } = await supabase
      .from("vendors")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error al cargar vendedores:", error.message);
      return;
    }

    setVendors(data || []);
  };

  useEffect(() => {
    loadVendors();
  }, []);

  const handleChange = (field: keyof typeof initialForm, value: string) => {
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
    setLoading(true);

    if (editingId) {
      const { error } = await supabase
        .from("vendors")
        .update({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          zone: formData.zone,
        })
        .eq("id", editingId);

      setLoading(false);

      if (error) {
        alert(`Error al editar vendedor: ${error.message}`);
        console.error(error);
        return;
      }

      resetForm();
      await loadVendors();
      return;
    }

    const { error } = await supabase.from("vendors").insert([
      {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        zone: formData.zone,
      },
    ]);

    setLoading(false);

    if (error) {
      alert(`Error al guardar vendedor: ${error.message}`);
      console.error(error);
      return;
    }

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
    });
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm(
      "¿Seguro que querés eliminar este vendedor?"
    );

    if (!confirmed) return;

    const { error } = await supabase.from("vendors").delete().eq("id", id);

    if (error) {
      alert(`Error al eliminar vendedor: ${error.message}`);
      console.error(error);
      return;
    }

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

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-3xl font-bold mb-6">Vendedores</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-xl bg-white p-6 shadow">
          <h2 className="text-xl font-semibold mb-4">
            {editingId ? "Editar vendedor" : "Nuevo vendedor"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Nombre</label>
              <input
                type="text"
                className="w-full rounded-md border px-3 py-2"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Ej: Juan Pérez"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Email</label>
              <input
                type="email"
                className="w-full rounded-md border px-3 py-2"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="Ej: juan@email.com"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Teléfono</label>
              <input
                type="text"
                className="w-full rounded-md border px-3 py-2"
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="Ej: 387..."
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Zona</label>
              <input
                type="text"
                className="w-full rounded-md border px-3 py-2"
                value={formData.zone}
                onChange={(e) => handleChange("zone", e.target.value)}
                placeholder="Ej: Salta Centro"
              />
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

        <section className="rounded-xl bg-white p-6 shadow flex flex-col">
          <div className="flex items-center justify-between mb-4 gap-3">
            <div>
              <h2 className="text-xl font-semibold">Listado</h2>
              <p className="text-sm text-slate-500">
                {filteredVendors.length} de {vendors.length} vendedores
              </p>
            </div>
          </div>

          <div className="flex gap-2 mb-4">
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
              className="rounded-md border px-3 py-2 text-sm whitespace-nowrap"
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
            <div className="flex-1 overflow-auto max-h-[600px] pr-2 space-y-2">
              {filteredVendors.map((vendor) => (
                <div
                  key={vendor.id}
                  className="rounded-lg border p-3 flex flex-col gap-1"
                >
                  <div className="flex justify-between items-start gap-3">
                    <p className="font-semibold text-sm">
                      {vendor.name || "Sin nombre"}
                    </p>

                    <div className="flex gap-2 shrink-0">
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