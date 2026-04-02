"use client";

import { useEffect, useState } from "react";
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

  const loadData = async () => {
    const [posRes, vendorsRes, merchantsRes] = await Promise.all([
      supabase
        .from("pos_devices")
        .select("id, code, status, vendor_id, merchant_id")
        .order("code"),
      supabase.from("vendors").select("id, name").order("name"),
      supabase
        .from("merchants")
        .select("id, name, vendor_id")
        .order("name"),
    ]);

    setPosDevices(posRes.data || []);
    setVendors(vendorsRes.data || []);
    setMerchants((merchantsRes.data as Merchant[]) || []);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleChange = (field: keyof typeof initialForm, value: string) => {
    if (field === "pos_id") {
      const selectedPos = posDevices.find((pos) => pos.id === value);

      setFormData((prev) => ({
        ...prev,
        pos_id: value,
        vendor_id: selectedPos?.vendor_id ?? "",
        merchant_id: selectedPos?.merchant_id ?? "",
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
      setFormData((prev) => {
        if (value === "assign_vendor") {
          return { ...prev, action: value, merchant_id: "" };
        }

        if (value === "return_stock") {
          return { ...prev, action: value, vendor_id: "", merchant_id: "" };
        }

        return { ...prev, action: value };
      });
      return;
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
    } = await supabase.auth.getUser();

    if (!user?.email) return null;

    const { data } = await supabase
      .from("app_users")
      .select("id, name, email, role")
      .eq("email", user.email)
      .maybeSingle();

    return data;
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
          vendor_id: formData.vendor_id || null,
          merchant_id: formData.merchant_id || null,
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

    const selectedPos = posDevices.find((p) => p.id === formData.pos_id);

    const selectedVendorName =
      vendors.find((v) => v.id === config.vendor_id)?.name || null;

    const selectedMerchantName =
      merchants.find((m) => m.id === config.merchant_id)?.name || null;

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
    pos_code: selectedPos?.code,
    type: config.movementType,
    vendor_id: config.vendor_id,
    vendor_name: selectedVendorName,
    merchant_id: config.merchant_id,
    merchant_name: selectedMerchantName,
    user_id: auditUser?.id,
    user_name: auditUser?.name,
    user_email: auditUser?.email,
    user_role: auditUser?.role,
    notes: formData.notes || "Movimiento desde asignaciones",
  },
]);

if (movementError) {
  setLoading(false);
  alert(`El POS se actualizó, pero falló el movimiento: ${movementError.message}`);
  console.error(movementError);
  loadData();
  return;
}

    setLoading(false);

    resetForm();
    loadData();

    alert("Asignación realizada correctamente");
  };

  const currentVendorName =
    vendors.find((v) => v.id === formData.vendor_id)?.name || "-";

  const currentMerchantName =
    merchants.find((m) => m.id === formData.merchant_id)?.name || "-";

  const selectedPosStatus =
    posDevices.find((p) => p.id === formData.pos_id)?.status || "-";

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-3xl font-bold mb-6">Asignaciones</h1>

      <div className="rounded-xl bg-white p-6 shadow max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">POS</label>
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
              <p>Estado actual: {getStatusLabel(selectedPosStatus)}</p>
              <p>Vendedor actual: {currentVendorName}</p>
              <p>Comercio actual: {currentMerchantName}</p>
            </div>
          )}

          <div>
            <label className="block text-sm mb-1">Acción</label>
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

          {(formData.action === "assign_vendor" ||
            formData.action === "maintenance") && (
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
                    {vendor.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {formData.action === "assign_merchant" && (
            <div>
              <label className="block text-sm mb-1">Comercio</label>
              <select
                className="w-full rounded-md border px-3 py-2"
                value={formData.merchant_id}
                onChange={(e) => handleChange("merchant_id", e.target.value)}
              >
                <option value="">Seleccionar comercio</option>
                {merchants.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                El vendedor se toma automáticamente del comercio seleccionado.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm mb-1">Nota</label>
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
              className="bg-black text-white px-4 py-2 rounded-md"
            >
              {loading ? "Guardando..." : "Guardar asignación"}
            </button>

            <button
              type="button"
              onClick={resetForm}
              className="border px-4 py-2 rounded-md"
            >
              Limpiar
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
