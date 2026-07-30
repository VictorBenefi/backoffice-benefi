"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ConfirmModal from "@/components/ui/ConfirmModal";
import NotificationBanner, {
  type NotificationMessage,
} from "@/components/ui/NotificationBanner";

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

type AssignmentAction =
  | "assign_vendor"
  | "assign_merchant"
  | "return_stock"
  | "maintenance";

type ActionConfig = {
  posStatus: string;
  movementType: string;
  vendor_id: string | null;
  merchant_id: string | null;
};

type PendingAssignment = {
  posId: string;
  posCode: string | null;
  action: AssignmentAction;
  config: ActionConfig;
  vendorName: string | null;
  merchantName: string | null;
  notes: string;
  confirmMessage: string;
};

const initialForm = {
  pos_id: "",
  action: "assign_vendor" as AssignmentAction,
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAssignment, setPendingAssignment] =
    useState<PendingAssignment | null>(null);

  const [notification, setNotification] =
    useState<NotificationMessage | null>(null);

  const getStatusLabel = (status: string | null) => {
    switch (status) {
      case "in_stock":
        return "En stock";
      case "assigned_vendor":
        return "Asignado a vendedor";
      case "assigned_merchant":
        return "Asignado a comercio";
      case "installed":
        return "Instalado";
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
      case "installed":
        return "bg-teal-100 text-teal-700";
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
      console.error(posRes.error);
      setNotification({
        type: "error",
        text: `Error al cargar los POS: ${posRes.error.message}`,
      });
      return;
    }

    if (vendorsRes.error) {
      console.error(vendorsRes.error);
      setNotification({
        type: "error",
        text: `Error al cargar los vendedores: ${vendorsRes.error.message}`,
      });
      return;
    }

    if (merchantsRes.error) {
      console.error(merchantsRes.error);
      setNotification({
        type: "error",
        text: `Error al cargar los comercios: ${merchantsRes.error.message}`,
      });
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
  const isInstalledPos = selectedPosStatus === "installed";

  const currentVendorName =
    vendors.find(
      (vendor) =>
        vendor.id === (selectedPos?.vendor_id || formData.vendor_id)
    )?.name || "-";

  const currentMerchantName =
    merchants.find(
      (merchant) =>
        merchant.id === (selectedPos?.merchant_id || formData.merchant_id)
    )?.name || "-";

  const handleChange = (
    field: keyof typeof initialForm,
    value: string
  ) => {
    setNotification(null);

    if (field === "pos_id") {
      const pos = posDevices.find((item) => item.id === value);

      setFormData((previous) => ({
        ...previous,
        pos_id: value,
        vendor_id: pos?.vendor_id ?? "",
        merchant_id: pos?.merchant_id ?? "",
      }));
      return;
    }

    if (field === "merchant_id") {
      const selectedMerchant = merchants.find(
        (merchant) => merchant.id === value
      );

      setFormData((previous) => ({
        ...previous,
        merchant_id: value,
        vendor_id: selectedMerchant?.vendor_id ?? "",
      }));
      return;
    }

    if (field === "action") {
      const action = value as AssignmentAction;

      if (action === "assign_vendor") {
        setFormData((previous) => ({
          ...previous,
          action,
          vendor_id: selectedPos?.vendor_id ?? "",
          merchant_id: "",
        }));
        return;
      }

      if (action === "assign_merchant") {
        setFormData((previous) => ({
          ...previous,
          action,
          vendor_id: "",
          merchant_id: "",
        }));
        return;
      }

      if (action === "return_stock") {
        setFormData((previous) => ({
          ...previous,
          action,
          vendor_id: "",
          merchant_id: "",
        }));
        return;
      }

      if (action === "maintenance") {
        setFormData((previous) => ({
          ...previous,
          action,
          vendor_id: selectedPos?.vendor_id ?? "",
          merchant_id: selectedPos?.merchant_id ?? "",
        }));
        return;
      }
    }

    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const resetForm = () => {
    if (loading) return;

    setFormData(initialForm);
    setPendingAssignment(null);
    setConfirmOpen(false);
  };

  const getCurrentAuditUser = async (): Promise<AppUser | null> => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user?.email) {
      return null;
    }

    const { data, error: appUserError } = await supabase
      .from("app_users")
      .select("id, name, email, role")
      .eq("email", user.email)
      .maybeSingle();

    if (appUserError) {
      console.error(appUserError);
      return null;
    }

    return data || null;
  };

  const getActionConfig = (): ActionConfig | null => {
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

  const getSuccessMessage = (assignment: PendingAssignment) => {
    switch (assignment.action) {
      case "assign_vendor":
        return `El POS ${
          assignment.posCode || "seleccionado"
        } fue asignado al vendedor ${
          assignment.vendorName || "-"
        } correctamente.`;

      case "assign_merchant":
        return `El POS ${
          assignment.posCode || "seleccionado"
        } fue asignado al comercio ${
          assignment.merchantName || "-"
        } correctamente.`;

      case "return_stock":
        return `El POS ${
          assignment.posCode || "seleccionado"
        } fue retornado a stock correctamente.`;

      case "maintenance":
        return `El POS ${
          assignment.posCode || "seleccionado"
        } fue enviado a mantenimiento correctamente.`;

      default:
        return "La operación se realizó correctamente.";
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setNotification(null);

    if (!formData.pos_id || !selectedPos) {
      setNotification({
        type: "warning",
        text: "Seleccioná un POS para continuar.",
      });
      return;
    }

    if (selectedPos.status === "installed") {
      setNotification({
        type: "warning",
        text: "Este POS ya está instalado y no puede reasignarse desde este módulo.",
      });
      return;
    }

    if (
      formData.action === "assign_vendor" &&
      !formData.vendor_id
    ) {
      setNotification({
        type: "warning",
        text: "Seleccioná el vendedor al que se asignará el POS.",
      });
      return;
    }

    if (
      formData.action === "assign_merchant" &&
      !formData.merchant_id
    ) {
      setNotification({
        type: "warning",
        text: "Seleccioná el comercio al que se asignará el POS.",
      });
      return;
    }

    const config = getActionConfig();

    if (!config) {
      setNotification({
        type: "error",
        text: "No se pudo determinar la acción seleccionada.",
      });
      return;
    }

    const selectedVendorName =
      vendors.find((vendor) => vendor.id === config.vendor_id)?.name || null;

    const selectedMerchantName =
      merchants.find((merchant) => merchant.id === config.merchant_id)?.name ||
      null;

    const confirmMessage =
      formData.action === "assign_vendor"
        ? `¿Confirmás asignar el POS ${
            selectedPos.code || "sin código"
          } al vendedor ${selectedVendorName || "-"}?`
        : formData.action === "assign_merchant"
          ? `¿Confirmás asignar el POS ${
              selectedPos.code || "sin código"
            } al comercio ${selectedMerchantName || "-"}?`
          : formData.action === "return_stock"
            ? `¿Confirmás retornar el POS ${
                selectedPos.code || "sin código"
              } a stock?`
            : `¿Confirmás enviar el POS ${
                selectedPos.code || "sin código"
              } a mantenimiento?`;

    setPendingAssignment({
      posId: formData.pos_id,
      posCode: selectedPos.code,
      action: formData.action,
      config,
      vendorName: selectedVendorName,
      merchantName: selectedMerchantName,
      notes: formData.notes.trim() || "Movimiento desde asignaciones",
      confirmMessage,
    });

    setConfirmOpen(true);
  };

  const handleCancelConfirmation = () => {
    if (loading) return;

    setConfirmOpen(false);
    setPendingAssignment(null);
  };

  const executeAssignment = async () => {
    if (!pendingAssignment) return;

    const assignment = pendingAssignment;

    setLoading(true);
    setNotification(null);

    try {
      const auditUser = await getCurrentAuditUser();

      const { error: posUpdateError } = await supabase
        .from("pos_devices")
        .update({
          status: assignment.config.posStatus,
          vendor_id: assignment.config.vendor_id,
          merchant_id: assignment.config.merchant_id,
        })
        .eq("id", assignment.posId);

      if (posUpdateError) {
        console.error(posUpdateError);
        setNotification({
          type: "error",
          text: `No se pudo actualizar el POS: ${posUpdateError.message}`,
        });
        return;
      }

      const { error: movementError } = await supabase
        .from("pos_movements")
        .insert([
          {
            pos_id: assignment.posId,
            pos_code: assignment.posCode,
            type: assignment.config.movementType,
            vendor_id: assignment.config.vendor_id,
            vendor_name: assignment.vendorName,
            merchant_id: assignment.config.merchant_id,
            merchant_name: assignment.merchantName,
            user_id: auditUser?.id || null,
            user_name: auditUser?.name || null,
            user_email: auditUser?.email || null,
            user_role: auditUser?.role || null,
            notes: assignment.notes,
          },
        ]);

      if (movementError) {
        console.error(movementError);
        setNotification({
          type: "warning",
          text: `El POS se actualizó, pero no se pudo registrar el movimiento: ${movementError.message}`,
        });

        setConfirmOpen(false);
        setPendingAssignment(null);
        await loadData();
        return;
      }

      const successMessage = getSuccessMessage(assignment);

      setConfirmOpen(false);
      setPendingAssignment(null);
      setFormData(initialForm);

      await loadData();

      setNotification({
        type: "success",
        text: successMessage,
      });
    } catch (error) {
      console.error(error);

      setNotification({
        type: "error",
        text:
          error instanceof Error
            ? `Ocurrió un error inesperado: ${error.message}`
            : "Ocurrió un error inesperado al realizar la asignación.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">
            Asignaciones
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Gestioná la asignación y el estado operativo de los equipos POS.
          </p>
        </div>

        <NotificationBanner
          message={notification}
          onClose={() => setNotification(null)}
          className="mb-5"
        />

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="pos_id"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                POS
              </label>

              <select
                id="pos_id"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                value={formData.pos_id}
                onChange={(event) =>
                  handleChange("pos_id", event.target.value)
                }
                disabled={loading}
              >
                <option value="">Seleccionar POS</option>

                {posDevices.map((pos) => (
                  <option key={pos.id} value={pos.id}>
                    {pos.code || "Sin código"} -{" "}
                    {getStatusLabel(pos.status)}
                  </option>
                ))}
              </select>
            </div>

            {formData.pos_id && selectedPos && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Equipo seleccionado
                    </p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">
                      {selectedPos.code || "POS sin código"}
                    </p>
                  </div>

                  <span
                    className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                      selectedPosStatus
                    )}`}
                  >
                    {getStatusLabel(selectedPosStatus)}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-xs text-slate-500">
                      Vendedor actual
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-800">
                      {currentVendorName}
                    </p>
                  </div>

                  <div className="rounded-lg bg-white p-3">
                    <p className="text-xs text-slate-500">
                      Comercio actual
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-800">
                      {currentMerchantName}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isInstalledPos && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Este POS ya está instalado. Para proteger la trazabilidad,
                no puede reasignarse desde este módulo.
              </div>
            )}

            <div>
              <label
                htmlFor="action"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Acción
              </label>

              <select
                id="action"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                value={formData.action}
                onChange={(event) =>
                  handleChange("action", event.target.value)
                }
                disabled={loading || isInstalledPos}
              >
                <option value="assign_vendor">
                  Asignar a vendedor
                </option>
                <option value="assign_merchant">
                  Asignar a comercio
                </option>
                <option value="return_stock">
                  Retornar a stock
                </option>
                <option value="maintenance">
                  Enviar a mantenimiento
                </option>
              </select>
            </div>

            {formData.action === "assign_vendor" && (
              <div>
                <label
                  htmlFor="vendor_id"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Vendedor
                </label>

                <select
                  id="vendor_id"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  value={formData.vendor_id}
                  onChange={(event) =>
                    handleChange("vendor_id", event.target.value)
                  }
                  disabled={loading || isInstalledPos}
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
                <label
                  htmlFor="merchant_id"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Comercio
                </label>

                <select
                  id="merchant_id"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  value={formData.merchant_id}
                  onChange={(event) =>
                    handleChange("merchant_id", event.target.value)
                  }
                  disabled={loading || isInstalledPos}
                >
                  <option value="">Seleccionar comercio</option>

                  {merchants.map((merchant) => (
                    <option key={merchant.id} value={merchant.id}>
                      {merchant.name || "Sin nombre"}
                    </option>
                  ))}
                </select>

                <p className="mt-1.5 text-xs text-slate-500">
                  El vendedor se toma automáticamente del comercio
                  seleccionado.
                </p>
              </div>
            )}

            {formData.action === "return_stock" && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                El POS volverá a stock y se eliminarán sus asignaciones
                actuales de vendedor y comercio.
              </div>
            )}

            {formData.action === "maintenance" && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                El POS se enviará a mantenimiento conservando su
                asignación actual.
              </div>
            )}

            <div>
              <label
                htmlFor="notes"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Nota
              </label>

              <textarea
                id="notes"
                rows={4}
                className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                value={formData.notes}
                onChange={(event) =>
                  handleChange("notes", event.target.value)
                }
                placeholder="Detalle del movimiento"
                disabled={loading || isInstalledPos}
              />
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row">
              <button
                type="submit"
                disabled={loading || isInstalledPos}
                className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
              >
                {loading
                  ? "Procesando..."
                  : isInstalledPos
                    ? "POS instalado"
                    : "Guardar asignación"}
              </button>

              <button
                type="button"
                onClick={resetForm}
                disabled={loading}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Limpiar
              </button>
            </div>
          </form>
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Confirmar operación"
        description={
          pendingAssignment?.confirmMessage ||
          "¿Confirmás realizar esta operación?"
        }
        confirmLabel="Confirmar"
        cancelLabel="Cancelar"
        loading={loading}
        onConfirm={executeAssignment}
        onCancel={handleCancelConfirmation}
      />
    </main>
  );
}