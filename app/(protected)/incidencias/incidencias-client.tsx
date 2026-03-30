"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Merchant = {
  id: string;
  name: string | null;
  vendor_id: string | null;
};

type Vendor = {
  id: string;
  name: string | null;
};

type PosDevice = {
  id: string;
  code: string | null;
  merchant_id: string | null;
  vendor_id: string | null;
};

type Incident = {
  id: string;
  merchant_id: string;
  vendor_id: string | null;
  pos_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  reported_at: string | null;
  resolved_at: string | null;
  created_at: string;
};

const initialForm = {
  merchant_id: "",
  vendor_id: "",
  pos_id: "",
  title: "",
  description: "",
  status: "open",
  priority: "medium",
};

export default function IncidenciasClient() {
  const supabase = createClient();

  const [formData, setFormData] = useState(initialForm);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [posDevices, setPosDevices] = useState<PosDevice[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    const [incRes, merRes, venRes, posRes] = await Promise.all([
      supabase
        .from("incidents")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("merchants")
        .select("id, name, vendor_id")
        .order("name"),
      supabase
        .from("vendors")
        .select("id, name")
        .order("name"),
      supabase
        .from("pos_devices")
        .select("id, code, merchant_id, vendor_id")
        .order("code"),
    ]);

    if (incRes.error) {
      console.error("Error al cargar incidencias:", incRes.error.message);
    } else {
      setIncidents(incRes.data || []);
    }

    if (merRes.error) {
      console.error("Error al cargar comercios:", merRes.error.message);
    } else {
      setMerchants(merRes.data || []);
    }

    if (venRes.error) {
      console.error("Error al cargar vendedores:", venRes.error.message);
    } else {
      setVendors(venRes.data || []);
    }

    if (posRes.error) {
      console.error("Error al cargar POS:", posRes.error.message);
    } else {
      setPosDevices(posRes.data || []);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getMerchantName = (merchantId: string | null) => {
    if (!merchantId) return "-";
    return merchants.find((m) => m.id === merchantId)?.name || "-";
  };

  const getVendorName = (vendorId: string | null) => {
    if (!vendorId) return "-";
    return vendors.find((v) => v.id === vendorId)?.name || "-";
  };

  const getPosCode = (posId: string | null) => {
    if (!posId) return "-";
    return posDevices.find((p) => p.id === posId)?.code || "-";
  };

  const getMerchantPosList = (merchantId: string) => {
    return posDevices.filter((p) => p.merchant_id === merchantId);
  };

  const merchantHasAssignedPos = (merchantId: string) => {
    return getMerchantPosList(merchantId).length > 0;
  };

  const handleMerchantChange = (merchantId: string) => {
    const selectedMerchant = merchants.find((m) => m.id === merchantId);
    const merchantPosList = getMerchantPosList(merchantId);
    const firstPos = merchantPosList[0] || null;

    const resolvedVendorId =
      selectedMerchant?.vendor_id || firstPos?.vendor_id || "";

    setFormData((prev) => ({
      ...prev,
      merchant_id: merchantId,
      vendor_id: resolvedVendorId,
      pos_id: firstPos?.id || "",
    }));
  };

  const handlePosChange = (posId: string) => {
    const selectedPos = posDevices.find((p) => p.id === posId);

    setFormData((prev) => ({
      ...prev,
      pos_id: posId,
      vendor_id: selectedPos?.vendor_id || prev.vendor_id,
    }));
  };

  const handleChange = (field: keyof typeof initialForm, value: string) => {
    if (field === "merchant_id" && !editingId) {
      handleMerchantChange(value);
      return;
    }

    if (field === "pos_id") {
      handlePosChange(value);
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const resetForm = () => {
    setFormData(initialForm);
    setEditingId(null);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "open":
        return "Abierta";
      case "in_progress":
        return "En proceso";
      case "resolved":
        return "Resuelta";
      default:
        return status;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case "open":
        return "bg-rose-100 text-rose-700";
      case "in_progress":
        return "bg-blue-100 text-blue-700";
      case "resolved":
        return "bg-emerald-100 text-emerald-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "low":
        return "Baja";
      case "medium":
        return "Media";
      case "high":
        return "Alta";
      default:
        return priority;
    }
  };

  const getPriorityClass = (priority: string) => {
    switch (priority) {
      case "low":
        return "bg-slate-100 text-slate-700";
      case "medium":
        return "bg-amber-100 text-amber-700";
      case "high":
        return "bg-red-100 text-red-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.merchant_id) {
      alert("Debés seleccionar un comercio.");
      return;
    }

    if (!merchantHasAssignedPos(formData.merchant_id)) {
      alert(
        "No se puede registrar la incidencia porque el comercio no tiene un POS asignado."
      );
      return;
    }

    if (!formData.pos_id) {
      alert("Debés seleccionar un POS del comercio.");
      return;
    }

    if (!formData.title.trim()) {
      alert("Debés ingresar un título.");
      return;
    }

    setLoading(true);

    const payload = {
      merchant_id: formData.merchant_id,
      vendor_id: formData.vendor_id || null,
      pos_id: formData.pos_id || null,
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      status: formData.status,
      priority: formData.priority,
      resolved_at:
        formData.status === "resolved" ? new Date().toISOString() : null,
    };

    if (editingId) {
      const { error } = await supabase
        .from("incidents")
        .update(payload)
        .eq("id", editingId);

      setLoading(false);

      if (error) {
        alert(`Error al editar incidencia: ${error.message}`);
        console.error(error);
        return;
      }

      resetForm();
      await loadData();
      return;
    }

    const { error } = await supabase.from("incidents").insert([
      {
        ...payload,
        reported_at: new Date().toISOString(),
      },
    ]);

    setLoading(false);

    if (error) {
      alert(`Error al guardar incidencia: ${error.message}`);
      console.error(error);
      return;
    }

    resetForm();
    await loadData();
  };

  const handleEdit = (item: Incident) => {
    setEditingId(item.id);
    setFormData({
      merchant_id: item.merchant_id || "",
      vendor_id: item.vendor_id || "",
      pos_id: item.pos_id || "",
      title: item.title || "",
      description: item.description || "",
      status: item.status || "open",
      priority: item.priority || "medium",
    });
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm(
      "¿Seguro que querés eliminar esta incidencia?"
    );

    if (!confirmed) return;

    const { error } = await supabase.from("incidents").delete().eq("id", id);

    if (error) {
      alert(`Error al eliminar incidencia: ${error.message}`);
      console.error(error);
      return;
    }

    if (editingId === id) {
      resetForm();
    }

    await loadData();
  };

  const filteredIncidents = useMemo(() => {
    const text = search.trim().toLowerCase();

    return incidents.filter((item) => {
      if (!text) return true;

      return (
        getMerchantName(item.merchant_id).toLowerCase().includes(text) ||
        getVendorName(item.vendor_id).toLowerCase().includes(text) ||
        getPosCode(item.pos_id).toLowerCase().includes(text) ||
        (item.title || "").toLowerCase().includes(text) ||
        (item.description || "").toLowerCase().includes(text) ||
        getStatusLabel(item.status).toLowerCase().includes(text) ||
        getPriorityLabel(item.priority).toLowerCase().includes(text)
      );
    });
  }, [incidents, search, merchants, vendors, posDevices]);

  const merchantPosList = formData.merchant_id
    ? getMerchantPosList(formData.merchant_id)
    : [];

  const selectedMerchantHasPos = formData.merchant_id
    ? merchantPosList.length > 0
    : true;

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-3xl font-bold mb-6">Incidencias / Soporte</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-xl bg-white p-6 shadow">
          <h2 className="text-xl font-semibold mb-4">
            {editingId ? "Editar incidencia" : "Nueva incidencia"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Comercio</label>
              <select
                className="w-full rounded-md border px-3 py-2"
                value={formData.merchant_id}
                onChange={(e) => handleChange("merchant_id", e.target.value)}
              >
                <option value="">Seleccionar comercio</option>
                {merchants.map((merchant) => (
                  <option key={merchant.id} value={merchant.id}>
                    {merchant.name || "Sin nombre"}
                  </option>
                ))}
              </select>
            </div>

            {!selectedMerchantHasPos && formData.merchant_id && (
              <div className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">
                El comercio seleccionado no tiene un POS asignado. No se podrá
                guardar la incidencia hasta asignarle uno.
              </div>
            )}

            <div>
              <label className="block text-sm mb-1">Vendedor</label>
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

            <div>
              <label className="block text-sm mb-1">POS</label>
              <select
                className="w-full rounded-md border px-3 py-2"
                value={formData.pos_id}
                onChange={(e) => handleChange("pos_id", e.target.value)}
              >
                <option value="">Seleccionar POS</option>
                {merchantPosList.map((pos) => (
                  <option key={pos.id} value={pos.id}>
                    {pos.code || "Sin código"}
                  </option>
                ))}
              </select>

              {merchantPosList.length > 1 && (
                <p className="mt-1 text-xs text-slate-500">
                  Este comercio tiene {merchantPosList.length} POS asignados.
                  Seleccioná el que corresponde a la incidencia.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm mb-1">Título</label>
              <input
                type="text"
                className="w-full rounded-md border px-3 py-2"
                value={formData.title}
                onChange={(e) => handleChange("title", e.target.value)}
                placeholder="Ej: POS no imprime ticket"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Descripción</label>
              <textarea
                className="w-full rounded-md border px-3 py-2"
                rows={4}
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="Detalle del reclamo o falla..."
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Estado</label>
              <select
                className="w-full rounded-md border px-3 py-2"
                value={formData.status}
                onChange={(e) => handleChange("status", e.target.value)}
              >
                <option value="open">Abierta</option>
                <option value="in_progress">En proceso</option>
                <option value="resolved">Resuelta</option>
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">Prioridad</label>
              <select
                className="w-full rounded-md border px-3 py-2"
                value={formData.priority}
                onChange={(e) => handleChange("priority", e.target.value)}
              >
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
              </select>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading || !selectedMerchantHasPos}
                className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
              >
                {loading
                  ? "Guardando..."
                  : editingId
                  ? "Actualizar incidencia"
                  : "Guardar incidencia"}
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
                {filteredIncidents.length} de {incidents.length} incidencias
              </p>
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por comercio, vendedor, POS, título, estado o prioridad..."
            />

            <button
              type="button"
              onClick={() => setSearch("")}
              className="rounded-md border px-3 py-2 text-sm whitespace-nowrap"
            >
              Limpiar
            </button>
          </div>

          {filteredIncidents.length === 0 ? (
            <p className="text-gray-500">
              {incidents.length === 0
                ? "No hay incidencias cargadas."
                : "No se encontraron incidencias con esa búsqueda."}
            </p>
          ) : (
            <div className="flex-1 overflow-auto max-h-[600px] pr-2 space-y-2">
              {filteredIncidents.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border p-3 flex flex-col gap-1"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <p className="font-semibold text-sm">{item.title}</p>
                      <p className="text-xs text-gray-600 mt-1">
                        {getMerchantName(item.merchant_id)}
                      </p>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleEdit(item)}
                        className="rounded-md bg-blue-600 px-2 py-1 text-xs text-white"
                      >
                        Editar
                      </button>

                      <button
                        onClick={() => handleDelete(item.id)}
                        className="rounded-md bg-red-600 px-2 py-1 text-xs text-white"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap mt-1">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getStatusClass(
                        item.status
                      )}`}
                    >
                      {getStatusLabel(item.status)}
                    </span>

                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getPriorityClass(
                        item.priority
                      )}`}
                    >
                      Prioridad: {getPriorityLabel(item.priority)}
                    </span>
                  </div>

                  <div className="text-xs text-gray-600 mt-1">
                    <p>Vendedor: {getVendorName(item.vendor_id)}</p>
                    <p>POS: {getPosCode(item.pos_id)}</p>
                    <p>Descripción: {item.description || "-"}</p>
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