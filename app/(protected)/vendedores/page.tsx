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
  is_active: boolean | null;
};

const initialForm = {
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
      toast.error(`Error al cargar vendedores: ${error.message}`);
      return;
    }

    setVendors((data as Vendor[]) || []);
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

  const handleEdit = (vendor: Vendor) => {
    setEditingId(vendor.id);
    setFormData({
      phone: vendor.phone || "",
      zone: vendor.zone || "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingId) {
      toast.warning("Seleccioná un vendedor para editar.");
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from("vendors")
      .update({
        phone: formData.phone.trim() || null,
        zone: formData.zone.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingId);

    setLoading(false);

    if (error) {
      toast.error(`Error al actualizar vendedor: ${error.message}`);
      return;
    }

    toast.success("Datos actualizados correctamente.");
    resetForm();
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
      <h1 className="mb-6 text-3xl font-bold">Vendedores</h1>

      <div className="grid gap-6 md:grid-cols-2">
        {/* FORMULARIO SOLO EDICIÓN */}
        <section className="rounded-xl bg-white p-6 shadow">
          <h2 className="mb-2 text-xl font-semibold">Editar vendedor</h2>

          <p className="mb-4 text-sm text-gray-500">
            Los vendedores se crean automáticamente desde el módulo Usuarios.
            Aquí solo podés completar datos adicionales.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
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

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-black px-4 py-2 text-white"
              >
                {loading ? "Guardando..." : "Guardar cambios"}
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

        {/* LISTADO */}
        <section className="flex flex-col rounded-xl bg-white p-6 shadow">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Listado</h2>
            <p className="text-sm text-slate-500">
              {filteredVendors.length} de {vendors.length} vendedores
            </p>
          </div>

          <div className="mb-4 flex gap-2">
            <input
              type="text"
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
            />

            <button
              type="button"
              onClick={() => setSearch("")}
              className="rounded-md border px-3 py-2 text-sm"
            >
              Limpiar
            </button>
          </div>

          {filteredVendors.length === 0 ? (
            <p className="text-gray-500">
              No hay vendedores para mostrar.
            </p>
          ) : (
            <div className="max-h-[600px] flex-1 space-y-2 overflow-auto pr-2">
              {filteredVendors.map((vendor) => (
                <div
                  key={vendor.id}
                  className="flex flex-col gap-1 rounded-lg border p-3"
                >
                  <div className="flex items-start justify-between">
                    <p className="text-sm font-semibold">
                      {vendor.name || "Sin nombre"}
                    </p>

                    <button
                      onClick={() => handleEdit(vendor)}
                      className="rounded-md bg-blue-600 px-2 py-1 text-xs text-white"
                    >
                      Editar
                    </button>
                  </div>

                  <div className="text-xs text-gray-600">
                    <p>Email: {vendor.email || "-"}</p>
                    <p>Tel: {vendor.phone || "-"}</p>
                    <p>Zona: {vendor.zone || "-"}</p>
                    <p>
                      Estado:{" "}
                      {vendor.is_active ? "Activo" : "Inactivo"}
                    </p>
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