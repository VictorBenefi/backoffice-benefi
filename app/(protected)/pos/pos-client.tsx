"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";

type Vendor = {
  id: string;
  name: string | null;
};

type Merchant = {
  id: string;
  name: string | null;
};

type AppUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
};

type PosDevice = {
  id: string;
  code: string | null;
  brand: string | null;
  model: string | null;
  serial: string | null;
  imei: string | null;
  imei_2: string | null;
  status: string | null;
  vendor_id: string | null;
  merchant_id: string | null;
  created_at: string;
};

const initialForm = {
  code: "",
  brand: "",
  model: "",
  serial: "",
  imei: "",
  imei_2: "",
  status: "in_stock",
  vendor_id: "",
  merchant_id: "",
};

export default function PosClient({
  canDeletePos,
}: {
  canDeletePos: boolean;
}) {
  const supabase = createClient();

  const [formData, setFormData] = useState(initialForm);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [posDevices, setPosDevices] = useState<PosDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [merchantFilter, setMerchantFilter] = useState("");

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
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error al cargar comercios:", error.message);
      return;
    }

    setMerchants(data || []);
  };

  const loadPosDevices = async () => {
    const { data, error } = await supabase
      .from("pos_devices")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error al cargar POS:", error.message);
      return;
    }

    setPosDevices(data || []);
  };

  useEffect(() => {
    loadVendors();
    loadMerchants();
    loadPosDevices();
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

  const normalize = (value: string | null | undefined) =>
    (value || "").trim().toLowerCase();

  const validateForm = () => {
    if (!formData.code.trim()) {
      alert("Debés completar el Código interno.");
      return false;
    }

    if (!formData.brand.trim()) {
      alert("Debés completar la Marca.");
      return false;
    }

    if (!formData.model.trim()) {
      alert("Debés completar el Modelo.");
      return false;
    }

    if (!formData.serial.trim()) {
      alert("Debés completar el Serial.");
      return false;
    }

    if (!formData.imei.trim()) {
      alert("Debés completar el IMEI 1.");
      return false;
    }

    return true;
  };

  const validateDuplicates = () => {
    const code = normalize(formData.code);
    const serial = normalize(formData.serial);
    const imei = normalize(formData.imei);
    const imei2 = normalize(formData.imei_2);

    for (const p of posDevices) {
      if (editingId && p.id === editingId) continue;

      const posCode = normalize(p.code);
      const posSerial = normalize(p.serial);
      const posImei = normalize(p.imei);
      const posImei2 = normalize(p.imei_2);

      if (code && posCode === code) {
        alert("Ya existe un POS con ese Código interno.");
        return false;
      }

      if (serial && posSerial === serial) {
        alert("Ya existe un POS con ese Serial.");
        return false;
      }

      if (imei && (posImei === imei || posImei2 === imei)) {
        alert("Ya existe un POS con ese IMEI 1.");
        return false;
      }

      if (imei2 && (posImei === imei2 || posImei2 === imei2)) {
        alert("Ya existe un POS con ese IMEI 2.");
        return false;
      }
    }

    return true;
  };

  const getVendorName = (vendorId: string | null) => {
    if (!vendorId) return "-";
    const vendor = vendors.find((v) => v.id === vendorId);
    return vendor?.name || "-";
  };

  const getMerchantName = (merchantId: string | null) => {
    if (!merchantId) return "-";
    const merchant = merchants.find((m) => m.id === merchantId);
    return merchant?.name || "-";
  };

  const getStatusLabel = (status: string | null) => {
    switch (status) {
      case "in_stock":
        return "En stock";
      case "assigned_vendor":
        return "Asignado a vendedor";
      case "assigned_merchant":
        return "Asignado a comercio";
      case "maintenance":
        return "Mantenimiento";
      case "inactive":
        return "Inactivo";
      default:
        return status || "-";
    }
  };

  const getStatusClass = (status: string | null) => {
    switch (status) {
      case "in_stock":
        return "bg-emerald-100 text-emerald-700";
      case "assigned_vendor":
        return "bg-blue-100 text-blue-700";
      case "assigned_merchant":
        return "bg-violet-100 text-violet-700";
      case "maintenance":
        return "bg-amber-100 text-amber-700";
      case "inactive":
        return "bg-rose-100 text-rose-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const getMovementType = (status: string) => {
    switch (status) {
      case "assigned_merchant":
        return "asignado_comercio";
      case "assigned_vendor":
        return "asignado_vendedor";
      case "maintenance":
        return "mantenimiento";
      case "inactive":
        return "baja";
      case "in_stock":
      default:
        return "retorno_stock";
    }
  };

  const getCurrentAuditUser = async (): Promise<AppUser | null> => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.email) {
      return null;
    }

    const { data, error } = await supabase
      .from("app_users")
      .select("id, name, email, role")
      .eq("email", user.email)
      .maybeSingle();

    if (error) {
      console.error("Error al obtener usuario auditoría:", error.message);
      return {
        id: user.id,
        name: user.email,
        email: user.email,
        role: null,
      };
    }

    if (!data) {
      return {
        id: user.id,
        name: user.email,
        email: user.email,
        role: null,
      };
    }

    return data;
  };

  const handleEdit = (pos: PosDevice) => {
    setEditingId(pos.id);
    setFormData({
      code: pos.code || "",
      brand: pos.brand || "",
      model: pos.model || "",
      serial: pos.serial || "",
      imei: pos.imei || "",
      imei_2: pos.imei_2 || "",
      status: pos.status || "in_stock",
      vendor_id: pos.vendor_id || "",
      merchant_id: pos.merchant_id || "",
    });
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm("¿Seguro que querés eliminar este POS?");
    if (!confirmed) return;

    const { error } = await supabase.from("pos_devices").delete().eq("id", id);

    if (error) {
      alert(`Error al eliminar POS: ${error.message}`);
      console.error(error);
      return;
    }

    if (editingId === id) {
      resetForm();
    }

    await loadPosDevices();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;
    if (!validateDuplicates()) return;

    setLoading(true);

    const selectedVendorName =
      formData.vendor_id ? getVendorName(formData.vendor_id) : null;

    const selectedMerchantName =
      formData.merchant_id ? getMerchantName(formData.merchant_id) : null;

    const auditUser = await getCurrentAuditUser();

    if (editingId) {
      const currentPos = posDevices.find((p) => p.id === editingId);

      const { error } = await supabase
        .from("pos_devices")
        .update({
          code: formData.code.trim(),
          brand: formData.brand.trim(),
          model: formData.model.trim(),
          serial: formData.serial.trim(),
          imei: formData.imei.trim(),
          imei_2: formData.imei_2.trim() || null,
          status: formData.status,
          vendor_id: formData.vendor_id || null,
          merchant_id: formData.merchant_id || null,
        })
        .eq("id", editingId);

      if (error) {
        setLoading(false);
        alert(`Error al editar POS: ${error.message}`);
        console.error(error);
        return;
      }

      const changed =
        currentPos?.status !== formData.status ||
        (currentPos?.vendor_id || "") !== formData.vendor_id ||
        (currentPos?.merchant_id || "") !== formData.merchant_id;

      if (changed) {
        const movementType = getMovementType(formData.status);

        const { error: movementError } = await supabase
          .from("pos_movements")
          .insert([
            {
              pos_id: editingId,
              pos_code: formData.code.trim(),
              type: movementType,
              vendor_id: formData.vendor_id || null,
              vendor_name:
                selectedVendorName && selectedVendorName !== "-"
                  ? selectedVendorName
                  : null,
              merchant_id: formData.merchant_id || null,
              merchant_name:
                selectedMerchantName && selectedMerchantName !== "-"
                  ? selectedMerchantName
                  : null,
              user_id: auditUser?.id || null,
              user_name: auditUser?.name || null,
              user_email: auditUser?.email || null,
              user_role: auditUser?.role || null,
              notes: "Actualización del POS",
            },
          ]);

        if (movementError) {
          setLoading(false);
          alert(
            `POS actualizado, pero falló el movimiento: ${movementError.message}`
          );
          console.error(movementError);
          await loadPosDevices();
          resetForm();
          return;
        }
      }

      setLoading(false);
      resetForm();
      await loadPosDevices();
      return;
    }

    const { data, error } = await supabase
      .from("pos_devices")
      .insert([
        {
          code: formData.code.trim(),
          brand: formData.brand.trim(),
          model: formData.model.trim(),
          serial: formData.serial.trim(),
          imei: formData.imei.trim(),
          imei_2: formData.imei_2.trim() || null,
          status: formData.status,
          vendor_id: formData.vendor_id || null,
          merchant_id: formData.merchant_id || null,
        },
      ])
      .select()
      .single();

    if (error) {
      setLoading(false);
      alert(`Error al guardar POS: ${error.message}`);
      console.error(error);
      return;
    }

    const movementType =
      formData.status === "assigned_merchant"
        ? "asignado_comercio"
        : formData.status === "assigned_vendor"
        ? "asignado_vendedor"
        : formData.status === "maintenance"
        ? "mantenimiento"
        : "ingreso_stock";

    const { error: movementError } = await supabase
      .from("pos_movements")
      .insert([
        {
          pos_id: data.id,
          pos_code: formData.code.trim(),
          type: movementType,
          vendor_id: formData.vendor_id || null,
          vendor_name:
            selectedVendorName && selectedVendorName !== "-"
              ? selectedVendorName
              : null,
          merchant_id: formData.merchant_id || null,
          merchant_name:
            selectedMerchantName && selectedMerchantName !== "-"
              ? selectedMerchantName
              : null,
          user_id: auditUser?.id || null,
          user_name: auditUser?.name || null,
          user_email: auditUser?.email || null,
          user_role: auditUser?.role || null,
          notes: "Alta inicial del equipo",
        },
      ]);

    setLoading(false);

    if (movementError) {
      alert(`POS guardado, pero falló el movimiento: ${movementError.message}`);
      console.error(movementError);
      await loadPosDevices();
      resetForm();
      return;
    }

    resetForm();
    await loadPosDevices();
  };

  const filteredPosDevices = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return posDevices.filter((pos) => {
      const matchesSearch =
        !searchText ||
        (pos.code || "").toLowerCase().includes(searchText) ||
        (pos.brand || "").toLowerCase().includes(searchText) ||
        (pos.model || "").toLowerCase().includes(searchText) ||
        (pos.serial || "").toLowerCase().includes(searchText) ||
        (pos.imei || "").toLowerCase().includes(searchText) ||
        (pos.imei_2 || "").toLowerCase().includes(searchText);

      const matchesStatus = !statusFilter || pos.status === statusFilter;
      const matchesVendor = !vendorFilter || pos.vendor_id === vendorFilter;
      const matchesMerchant =
        !merchantFilter || pos.merchant_id === merchantFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesVendor &&
        matchesMerchant
      );
    });
  }, [posDevices, search, statusFilter, vendorFilter, merchantFilter]);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setVendorFilter("");
    setMerchantFilter("");
  };

  const handleExportExcel = () => {
    const exportData = filteredPosDevices.map((pos) => ({
      Codigo: pos.code || "",
      Marca: pos.brand || "",
      Modelo: pos.model || "",
      Serial: pos.serial || "",
      "IMEI 1": pos.imei || "",
      "IMEI 2": pos.imei_2 || "",
      Estado: getStatusLabel(pos.status),
      Vendedor: getVendorName(pos.vendor_id),
      Comercio: getMerchantName(pos.merchant_id),
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "POS");
    XLSX.writeFile(workbook, "listado_pos.xlsx");
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-3xl font-bold mb-6">POS / Terminales</h1>

      <div className="grid gap-6 md:grid-cols-[420px_1fr]">
        <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
          <h2 className="text-xl font-semibold mb-4">
            {editingId ? "Editar POS" : "Nuevo POS"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Código interno</label>
              <input
                type="text"
                required
                className="w-full rounded-md border px-3 py-2"
                value={formData.code}
                onChange={(e) => handleChange("code", e.target.value)}
                placeholder="Ej: POS-001"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Marca</label>
              <input
                type="text"
                required
                className="w-full rounded-md border px-3 py-2"
                value={formData.brand}
                onChange={(e) => handleChange("brand", e.target.value)}
                placeholder="Ej: UROVO"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Modelo</label>
              <input
                type="text"
                required
                className="w-full rounded-md border px-3 py-2"
                value={formData.model}
                onChange={(e) => handleChange("model", e.target.value)}
                placeholder="Ej: i9100"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Serial</label>
              <input
                type="text"
                required
                className="w-full rounded-md border px-3 py-2"
                value={formData.serial}
                onChange={(e) => handleChange("serial", e.target.value)}
                placeholder="Ej: SRL123456"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">IMEI 1</label>
              <input
                type="text"
                required
                className="w-full rounded-md border px-3 py-2"
                value={formData.imei}
                onChange={(e) => handleChange("imei", e.target.value)}
                placeholder="Ej: 123456789012345"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">IMEI 2</label>
              <input
                type="text"
                className="w-full rounded-md border px-3 py-2"
                value={formData.imei_2}
                onChange={(e) => handleChange("imei_2", e.target.value)}
                placeholder="Ej: 987654321098765"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Estado</label>
              <select
                className="w-full rounded-md border px-3 py-2"
                value={formData.status}
                onChange={(e) => handleChange("status", e.target.value)}
              >
                <option value="in_stock">En stock</option>
                <option value="assigned_vendor">Asignado a vendedor</option>
                <option value="assigned_merchant">Asignado a comercio</option>
                <option value="maintenance">Mantenimiento</option>
                <option value="inactive">Inactivo</option>
              </select>
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

            <div>
              <label className="block text-sm mb-1">Comercio asignado</label>
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

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-black px-4 py-2 text-white"
              >
                {loading
                  ? "Guardando..."
                  : editingId
                  ? "Actualizar POS"
                  : "Guardar POS"}
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

        <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200 h-[850px] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">Listado</h2>
              <span className="text-sm text-slate-500">
                {filteredPosDevices.length} de {posDevices.length} equipos
              </span>
            </div>

            <button
              type="button"
              onClick={handleExportExcel}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700"
            >
              Exportar Excel
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 mb-4">
            <input
              type="text"
              placeholder="Buscar por código, serial, IMEI..."
              className="rounded-md border px-3 py-2 text-sm xl:col-span-2"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              className="rounded-md border px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Todos los estados</option>
              <option value="in_stock">En stock</option>
              <option value="assigned_vendor">Asignado a vendedor</option>
              <option value="assigned_merchant">Asignado a comercio</option>
              <option value="maintenance">Mantenimiento</option>
              <option value="inactive">Inactivo</option>
            </select>

            <button
              type="button"
              onClick={clearFilters}
              className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50"
            >
              Limpiar filtros
            </button>

            <select
              className="rounded-md border px-3 py-2 text-sm"
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
            >
              <option value="">Todos los vendedores</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name || "Sin nombre"}
                </option>
              ))}
            </select>

            <select
              className="rounded-md border px-3 py-2 text-sm"
              value={merchantFilter}
              onChange={(e) => setMerchantFilter(e.target.value)}
            >
              <option value="">Todos los comercios</option>
              {merchants.map((merchant) => (
                <option key={merchant.id} value={merchant.id}>
                  {merchant.name || "Sin nombre"}
                </option>
              ))}
            </select>
          </div>

          {filteredPosDevices.length === 0 ? (
            <p className="text-gray-500">No hay POS para mostrar.</p>
          ) : (
            <div className="overflow-auto flex-1 rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-slate-100 z-10">
                  <tr className="text-left">
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Marca</th>
                    <th className="px-4 py-3">Modelo</th>
                    <th className="px-4 py-3">Serial</th>
                    <th className="px-4 py-3">IMEI 1</th>
                    <th className="px-4 py-3">IMEI 2</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Vendedor</th>
                    <th className="px-4 py-3">Comercio</th>
                    <th className="px-4 py-3">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredPosDevices.map((pos) => (
                    <tr key={pos.id} className="border-t align-top">
                      <td className="px-4 py-3 font-medium">
                        {pos.code || "-"}
                      </td>
                      <td className="px-4 py-3">{pos.brand || "-"}</td>
                      <td className="px-4 py-3">{pos.model || "-"}</td>
                      <td className="px-4 py-3">{pos.serial || "-"}</td>
                      <td className="px-4 py-3">{pos.imei || "-"}</td>
                      <td className="px-4 py-3">{pos.imei_2 || "-"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                            pos.status
                          )}`}
                        >
                          {getStatusLabel(pos.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {getVendorName(pos.vendor_id)}
                      </td>
                      <td className="px-4 py-3">
                        {getMerchantName(pos.merchant_id)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleEdit(pos)}
                            className="rounded-md bg-blue-600 px-3 py-1 text-xs text-white"
                          >
                            Editar
                          </button>

                          {canDeletePos && (
                            <button
                              onClick={() => handleDelete(pos.id)}
                              className="rounded-md bg-red-600 px-3 py-1 text-xs text-white"
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}