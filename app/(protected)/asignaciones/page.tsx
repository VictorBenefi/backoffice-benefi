"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type PosDevice = {
  id: string;
  code: string | null;
  status: string | null;
  vendor_id: string | null;
  merchant_id: string | null;
};

type Vendor = {
  id: string;
  name: string | null;
  is_active?: boolean | null;
};

type Merchant = {
  id: string;
  name: string | null;
  vendor_id: string | null;
};

type AppUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
};

const initialForm = {
  pos_id: "",
  action: "assign_vendor",
  vendor_id: "",
  merchant_id: "",
  notes: "",
};

export default function AsignacionesPage() {
  const supabase = createClient();

  const [formData, setFormData] = useState(initialForm);
  const [posDevices, setPosDevices] = useState<PosDevice[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(false);

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

  const loadData = async () => {
    const [posRes, vendorsRes, merchantsRes] = await Promise.all([
      supabase
        .from("pos_devices")
        .select("id, code, status, vendor_id, merchant_id")
        .order("code"),
      supabase
        .from("vendors")
        .select("id, name, is_active")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("merchants")
        .select("id, name, vendor_id")
        .order("name"),
    ]);

    if (posRes.error) {
      alert(`Error al cargar POS: ${posRes.error.message}`);
      return;
    }

    if (vendorsRes.error) {
      alert(`Error al cargar vendedores: ${vendorsRes.error.message}`);
      return;
    }

    if (merchantsRes.error) {
      alert(`Error al cargar comercios: ${merchantsRes.error.message}`);
      return;
    }

    setPosDevices((posRes.data as PosDevice[]) || []);
    setVendors((vendorsRes.data as Vendor[]) || []);
    setMerchants((merchantsRes.data as Merchant[]) || []);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedPos = useMemo(
    () => posDevices.find((pos) => pos.id === formData.pos_id) || null,
    [posDevices, formData.pos_id]
  );

  const selectedPosStatus = selectedPos?.status || null;

  const currentVendorName =
    vendors.find((v) => v.id === (selectedPos?.vendor_id || formData.vendor_id))
      ?.name || "-";

  const currentMerchantName =
    merchants.find(
      (m) => m.id === (selectedPos?.merchant_id || formData.merchant_id)
    )?.name || "-";

  const handleChange = (field: keyof typeof initialForm, value: string) => {
    if (field === "pos_id") {
      const pos = posDevices.find((item) => item.id === value);

      setFormData((prev) => ({
        ...prev,
        pos_id: value,
        vendor_id: pos?.vendor_id ?? "",
        merchant_id: pos?.merchant_id ?? "",
      }));
      return;
    }

    if (field === "merchant_id") {
      const selectedMerchant = merchants.find((m) => m.id === value);

      setFormData((prev) => ({
        ...prev,
        merchant_id: value,
        vendor_id: selectedMerchant?.vendor_id ?? "",
      }));
      return;
    }

    if (field === "action") {
      if (value === "assign_vendor") {
        setFormData((prev) => ({
          ...prev,
          action: value,
          vendor_id: selectedPos?.vendor_id ?? "",
          merchant_id: "",
        }));
        return;
      }

      if (value === "assign_merchant") {
        setFormData((prev) => ({
          ...prev,
          action: value,
          vendor_id: "",
          merchant_id: "",
        }));
        return;
      }

      if (value === "return_stock") {
        setFormData((prev) => ({
          ...prev,
          action: value,
          vendor_id: "",
          merchant_id: "",
        }));
        return;
      }

      if (value === "maintenance") {
        setFormData((prev) => ({
          ...prev,
          action: value,
          vendor_id: selectedPos?.vendor_id ?? "",
          merchant_id: selectedPos?.merchant_id ?? "",
        }));
        return;
      }
    }

    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const resetForm = () => {
    setFormData(initialForm);
  };

  const getCurrentAuditUser = async (): Promise<AppUser | null> => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user?.email) return null;

    const { data } = await supabase
      .from("app_users")
      .select("id, name, email, role")
      .eq("email", user.email)
      .maybeSingle();

    return data || null;
  };

  const getActionConfig = () => {
    switch (formData.action) {
      case "assign_vendor":
        return {
          posStatus: "assigned_vendor",
          movementType: "asignado_vendedor",
          vendor_id: formData.vendor_id || null,
          merchant_id: null,
        };

      case "assign_merchant":
        return {
          posStatus: "assigned_merchant",
          movementType: "asignado_comercio",
          vendor_id: formData.vendor_id || null,
          merchant_id: formData.merchant_id || null,
        };

      case "return_stock":
        return {
          posStatus: "in_stock",
          movementType: "retorno_stock",
          vendor_id: null,
          merchant_id: null,
        };

      case "maintenance":
        return {
          posStatus: "maintenance",
          movementType: "mantenimiento",
          vendor_id: selectedPos?.vendor_id || null,
          merchant_id: selectedPos?.merchant_id || null,
        };

      default:
        return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const config = getActionConfig();
    if (!config) return;

    if (!formData.pos_id) {
      alert("Seleccioná un POS.");
      return;
    }

    if (formData.action === "assign_vendor" && !formData.vendor_id) {
      alert("Seleccioná un vendedor.");
      return;
    }

    if (formData.action === "assign_merchant" && !formData.merchant_id) {
      alert("Seleccioná un comercio.");
      return;
    }

    const selectedVendorName =
      vendors.find((v) => v.id === config.vendor_id)?.name || null;

    const selectedMerchantName =
      merchants.find((m) => m.id === config.merchant_id)?.name || null;

    const confirmMessage =
      formData.action === "assign_vendor"
        ? `¿Confirmás asignar el POS ${selectedPos?.code || ""} al vendedor ${selectedVendorName || "-" }?`
        : formData.action === "assign_merchant"
        ? `¿Confirmás asignar el POS ${selectedPos?.code || ""} al comercio ${selectedMerchantName || "-" }?`
        : formData.action === "return_stock"
        ? `¿Confirmás retornar el POS ${selectedPos?.code || ""} a stock?`
        : `¿Confirmás enviar el POS ${selectedPos?.code || ""} a mantenimiento?`;

    if (!window.confirm(confirmMessage)) return;

    const auditUser = await getCurrentAuditUser();

    setLoading(true);

    const { error: posUpdateError } = await supabase
      .from("pos_devices")
      .update({
        status: config.posStatus,
        vendor_id: config.vendor_id,
        merchant_id: config.merchant_id,
      })
      .eq("id", formData.pos_id);

    if (posUpdateError) {
      setLoading(false);
      alert(`No se pudo actualizar el POS: ${posUpdateError.message}`);
      console.error(posUpdateError);
      return;
    }

    const { error: movementError } = await supabase.from("pos_movements").insert([
      {
        pos_id: formData.pos_id,
        pos_code: selectedPos?.code || null,
        type: config.movementType,
        vendor_id: config.vendor_id,
        vendor_name: selectedVendorName,
        merchant_id: config.merchant_id,
        merchant_name: selectedMerchantName,
        user_id: auditUser?.id || null,
        user_name: auditUser?.name || null,
        user_email: auditUser?.email || null,
        user_role: auditUser?.role || null,
        notes: formData.notes.trim() || "Movimiento desde asignaciones",
      },
    ]);

    if (movementError) {
      setLoading(false);
      alert(
        `El POS se actualizó, pero falló el movimiento: ${movementError.message}`
      );
      console.error(movementError);
      await loadData();
      return;
    }

    setLoading(false);
    resetForm();
    await loadData();

    alert("Asignación realizada correctamente.");
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <h1 className="mb-6 text-3xl font-bold">Asignaciones</h1>

      <div className="max-w-3xl rounded-xl bg-white p-6 shadow">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm">POS</label>
            <select
              className="w-full rounded-md border px-3 py-2"
              value={formData.pos_id}
              onChange={(e) => handleChange("pos_id", e.target.value)}
            >
              <option value="">Seleccionar POS</option>
              {posDevices.map((pos) => (
                <option key={pos.id} value={pos.id}>
                  {pos.code || "Sin código"} - {getStatusLabel(pos.status)}
                </option>
              ))}
            </select>
          </div>

          {formData.pos_id && (
            <div className="rounded-md bg-gray-100 p-3 text-sm">
              <p>
                Estado actual:{" "}
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                    selectedPosStatus
                  )}`}
                >
                  {getStatusLabel(selectedPosStatus)}
                </span>
              </p>
              <p className="mt-2">Vendedor actual: {currentVendorName}</p>
              <p>Comercio actual: {currentMerchantName}</p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm">Acción</label>
            <select
              className="w-full rounded-md border px-3 py-2"
              value={formData.action}
              onChange={(e) => handleChange("action", e.target.value)}
            >
              <option value="assign_vendor">Asignar a vendedor</option>
              <option value="assign_merchant">Asignar a comercio</option>
              <option value="return_stock">Retornar a stock</option>
              <option value="maintenance">Enviar a mantenimiento</option>
            </select>
          </div>

          {formData.action === "assign_vendor" && (
            <div>
              <label className="mb-1 block text-sm">Vendedor</label>
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
          )}

          {formData.action === "assign_merchant" && (
            <div>
              <label className="mb-1 block text-sm">Comercio</label>
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
              <p className="mt-1 text-xs text-slate-500">
                El vendedor se toma automáticamente del comercio seleccionado.
              </p>
            </div>
          )}

          {formData.action === "maintenance" && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              El POS se enviará a mantenimiento conservando su asignación actual.
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm">Nota</label>
            <textarea
              className="w-full rounded-md border px-3 py-2"
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="Detalle del movimiento"
            />
          </div>

          <div className="flex gap-3">
            <button
              disabled={loading}
              className="rounded-md bg-black px-4 py-2 text-white"
            >
              {loading ? "Guardando..." : "Guardar asignación"}
            </button>

            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border px-4 py-2"
            >
              Limpiar
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}