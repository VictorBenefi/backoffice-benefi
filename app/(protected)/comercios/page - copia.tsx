"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Vendor = {
  id: string;
  name: string | null;
};

type Merchant = {
  id: string;
  name: string | null;
  email: string | null;
  cuit: string | null;
  phone: string | null;
  address: string | null;
  zone: string | null;
  vendor_id: string | null;
  created_at: string;
};

const initialForm = {
  name: "",
  email: "",
  cuit: "",
  phone: "",
  address: "",
  zone: "",
  vendor_id: "",
};

export default function ComerciosPage() {
  const supabase = createClient();

  const [formData, setFormData] = useState(initialForm);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const loadVendors = async () => {
    const { data, error } = await supabase
      .from("vendors")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error al cargar vendedores:", error.message);
      return;
    }

    setVendors(data || []);
  };

  const loadMerchants = async () => {
    const { data, error } = await supabase
      .from("merchants")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error al cargar comercios:", error.message);
      return;
    }

    setMerchants(data || []);
  };

  useEffect(() => {
    loadVendors();
    loadMerchants();
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

  const getVendorName = (vendorId: string | null) => {
    if (!vendorId) return "-";
    const vendor = vendors.find((v) => v.id === vendorId);
    return vendor?.name || "-";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (editingId) {
      const { error } = await supabase
        .from("merchants")
        .update({
          name: formData.name,
          email: formData.email || null,
          cuit: formData.cuit,
          phone: formData.phone,
          address: formData.address,
          zone: formData.zone,
          vendor_id: formData.vendor_id || null,
        })
        .eq("id", editingId);

      setLoading(false);

      if (error) {
        alert(`Error al editar comercio: ${error.message}`);
        console.error(error);
        return;
      }

      resetForm();
      await loadMerchants();
      return;
    }

    const { error } = await supabase.from("merchants").insert([
      {
        name: formData.name,
        email: formData.email || null,
        cuit: formData.cuit,
        phone: formData.phone,
        address: formData.address,
        zone: formData.zone,
        vendor_id: formData.vendor_id || null,
      },
    ]);

    setLoading(false);

    if (error) {
      alert(`Error al guardar comercio: ${error.message}`);
      console.error(error);
      return;
    }

    resetForm();
    await loadMerchants();
  };

  const handleEdit = (merchant: Merchant) => {
    setEditingId(merchant.id);
    setFormData({
      name: merchant.name || "",
      email: merchant.email || "",
      cuit: merchant.cuit || "",
      phone: merchant.phone || "",
      address: merchant.address || "",
      zone: merchant.zone || "",
      vendor_id: merchant.vendor_id || "",
    });
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm(
      "¿Seguro que querés eliminar este comercio?"
    );

    if (!confirmed) return;

    const { error } = await supabase.from("merchants").delete().eq("id", id);

    if (error) {
      alert(`Error al eliminar comercio: ${error.message}`);
      console.error(error);
      return;
    }

    if (editingId === id) {
      resetForm();
    }

    await loadMerchants();
  };

  const filteredMerchants = useMemo(() => {
    const text = search.trim().toLowerCase();

    return merchants.filter((merchant) => {
      if (!text) return true;

      return (
        (merchant.name || "").toLowerCase().includes(text) ||
        (merchant.email || "").toLowerCase().includes(text) ||
        (merchant.cuit || "").toLowerCase().includes(text) ||
        (merchant.phone || "").toLowerCase().includes(text) ||
        (merchant.address || "").toLowerCase().includes(text) ||
        (merchant.zone || "").toLowerCase().includes(text) ||
        getVendorName(merchant.vendor_id).toLowerCase().includes(text)
      );
    });
  }, [merchants, search, vendors]);

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-3xl font-bold mb-6">Comercios</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-xl bg-white p-6 shadow">
          <h2 className="text-xl font-semibold mb-4">
            {editingId ? "Editar comercio" : "Nuevo comercio"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Nombre</label>
              <input
                type="text"
                className="w-full rounded-md border px-3 py-2"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Ej: Farmacia Centro"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Email</label>
              <input
                type="email"
                className="w-full rounded-md border px-3 py-2"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="Ej: comercio@email.com"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">CUIT</label>
              <input
                type="text"
                className="w-full rounded-md border px-3 py-2"
                value={formData.cuit}
                onChange={(e) => handleChange("cuit", e.target.value)}
                placeholder="Ej: 30-12345678-9"
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
              <label className="block text-sm mb-1">Dirección</label>
              <input
                type="text"
                className="w-full rounded-md border px-3 py-2"
                value={formData.address}
                onChange={(e) => handleChange("address", e.target.value)}
                placeholder="Ej: Av. Belgrano 123"
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

            <div>
              <label className="block text-sm mb-1">Vendedor asignado</label>
              <select
                className="w-full rounded-md border px-3 py-2"
                value={formData.vendor_id}
                onChange={(e) => handleChange("vendor_id", e.target.value)}
              >
                <option value="">Seleccionar vendedor</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name || "Sin nombre"}
                  </option>
                ))}
              </select>
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
                  ? "Actualizar comercio"
                  : "Guardar comercio"}
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
                {filteredMerchants.length} de {merchants.length} comercios
              </p>
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, email, CUIT, teléfono, dirección, zona o vendedor..."
            />

            <button
              type="button"
              onClick={() => setSearch("")}
              className="rounded-md border px-3 py-2 text-sm whitespace-nowrap"
            >
              Limpiar
            </button>
          </div>

          {filteredMerchants.length === 0 ? (
            <p className="text-gray-500">
              {merchants.length === 0
                ? "No hay comercios cargados."
                : "No se encontraron comercios con esa búsqueda."}
            </p>
          ) : (
            <div className="flex-1 overflow-auto max-h-[600px] pr-2 space-y-2">
              {filteredMerchants.map((merchant) => (
                <div
                  key={merchant.id}
                  className="rounded-lg border p-3 flex flex-col gap-1"
                >
                  <div className="flex justify-between items-start gap-3">
                    <p className="font-semibold text-sm">
                      {merchant.name || "Sin nombre"}
                    </p>

                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleEdit(merchant)}
                        className="rounded-md bg-blue-600 px-2 py-1 text-xs text-white"
                      >
                        Editar
                      </button>

                      <button
                        onClick={() => handleDelete(merchant.id)}
                        className="rounded-md bg-red-600 px-2 py-1 text-xs text-white"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>

                  <div className="text-xs text-gray-600">
                    <p>Email: {merchant.email || "-"}</p>
                    <p>CUIT: {merchant.cuit || "-"}</p>
                    <p>Tel: {merchant.phone || "-"}</p>
                    <p>Dirección: {merchant.address || "-"}</p>
                    <p>Zona: {merchant.zone || "-"}</p>
                    <p>Vendedor: {getVendorName(merchant.vendor_id)}</p>
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