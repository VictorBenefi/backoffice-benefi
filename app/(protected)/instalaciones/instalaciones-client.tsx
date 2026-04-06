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
  status: string | null;
};

type Installation = {
  id: string;
  merchant_id: string;
  vendor_id: string | null;
  pos_id: string | null;
  status: string;
  install_date: string | null;
  notes: string | null;
  created_at: string;
};

type AppUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
};

const initialForm = {
  merchant_id: "",
  vendor_id: "",
  pos_id: "",
  status: "pending",
  install_date: "",
  notes: "",
};

export default function InstalacionesClient() {
  const supabase = createClient();

  const [formData, setFormData] = useState(initialForm);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [posDevices, setPosDevices] = useState<PosDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const loadData = async () => {
    const [installationsRes, merchantsRes, vendorsRes, posRes] =
      await Promise.all([
        supabase
          .from("installations")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("merchants")
          .select("id, name, vendor_id")
          .order("name"),
        supabase.from("vendors").select("id, name").order("name"),
        supabase
          .from("pos_devices")
          .select("id, code, merchant_id, vendor_id, status")
          .order("code"),
      ]);

    if (installationsRes.error) {
      console.error(
        "Error al cargar instalaciones:",
        installationsRes.error.message
      );
    } else {
      setInstallations((installationsRes.data as Installation[]) || []);
    }

    if (merchantsRes.error) {
      console.error("Error al cargar comercios:", merchantsRes.error.message);
    } else {
      setMerchants((merchantsRes.data as Merchant[]) || []);
    }

    if (vendorsRes.error) {
      console.error("Error al cargar vendedores:", vendorsRes.error.message);
    } else {
      setVendors((vendorsRes.data as Vendor[]) || []);
    }

    if (posRes.error) {
      console.error("Error al cargar POS:", posRes.error.message);
    } else {
      setPosDevices((posRes.data as PosDevice[]) || []);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      .eq("email", user.email.trim().toLowerCase())
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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "Pendiente";
      case "in_progress":
        return "En proceso";
      case "completed":
        return "Completada";
      case "cancelled":
        return "Cancelada";
      default:
        return status;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-amber-100 text-amber-700";
      case "in_progress":
        return "bg-blue-100 text-blue-700";
      case "completed":
        return "bg-emerald-100 text-emerald-700";
      case "cancelled":
        return "bg-rose-100 text-rose-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const getAssignedMerchantPosList = (merchantId: string) => {
    return posDevices.filter(
      (p) => p.merchant_id === merchantId && p.status === "assigned_merchant"
    );
  };

  const hasActiveInstallation = (posId: string) => {
    return installations.some(
      (i) => i.pos_id === posId && i.id !== editingId && i.status !== "cancelled"
    );
  };

  const getEligiblePosListForMerchant = (merchantId: string, vendorId: string) => {
    if (!merchantId || !vendorId) return [];

    return posDevices.filter((p) => {
      const sameVendor = p.vendor_id === vendorId;

      const assignedToVendor = p.status === "assigned_vendor" && sameVendor;

      const assignedToThisMerchant =
        p.status === "assigned_merchant" &&
        p.merchant_id === merchantId &&
        sameVendor;

      if (!assignedToVendor && !assignedToThisMerchant) return false;
      if (hasActiveInstallation(p.id)) return false;

      return true;
    });
  };

  const getSelectablePosList = () => {
    const eligible = getEligiblePosListForMerchant(
      formData.merchant_id,
      formData.vendor_id
    );

    if (!editingId || !formData.pos_id) {
      return eligible;
    }

    const currentPos = posDevices.find((p) => p.id === formData.pos_id);
    if (!currentPos) return eligible;

    const exists = eligible.some((p) => p.id === currentPos.id);
    if (exists) return eligible;

    return [currentPos, ...eligible];
  };

  const handleMerchantChange = (merchantId: string) => {
    const selectedMerchant = merchants.find((m) => m.id === merchantId);
    const resolvedVendorId = selectedMerchant?.vendor_id || "";

    setFormData((prev) => ({
      ...prev,
      merchant_id: merchantId,
      vendor_id: resolvedVendorId,
      pos_id: "",
    }));
  };

  const handleChange = (field: keyof typeof initialForm, value: string) => {
    if (field === "merchant_id" && !editingId) {
      handleMerchantChange(value);
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

  const insertMovement = async ({
    posId,
    posCode,
    type,
    vendorId,
    vendorName,
    merchantId,
    merchantName,
    notes,
  }: {
    posId: string | null;
    posCode: string | null;
    type: string;
    vendorId: string | null;
    vendorName: string | null;
    merchantId: string | null;
    merchantName: string | null;
    notes: string;
  }) => {
    const auditUser = await getCurrentAuditUser();

    return supabase.from("pos_movements").insert([
      {
        pos_id: posId,
        pos_code: posCode,
        type,
        vendor_id: vendorId,
        vendor_name: vendorName,
        merchant_id: merchantId,
        merchant_name: merchantName,
        user_id: auditUser?.id || null,
        user_name: auditUser?.name || null,
        user_email: auditUser?.email || null,
        user_role: auditUser?.role || null,
        notes,
      },
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.merchant_id) {
      alert("Debés seleccionar un comercio.");
      return;
    }

    if (!formData.vendor_id) {
      alert("No se encontró un vendedor asignado para ese comercio.");
      return;
    }

    if (!formData.pos_id) {
      alert("Debés seleccionar un POS.");
      return;
    }

    if (formData.status === "completed" && !formData.install_date) {
      alert(
        "Si la instalación está completada, debés indicar la fecha de instalación."
      );
      return;
    }

    const selectedPos = posDevices.find((p) => p.id === formData.pos_id);

    if (!selectedPos) {
      alert("No se encontró el POS seleccionado.");
      return;
    }

    if (!editingId) {
      const canUsePos =
        (selectedPos.status === "assigned_vendor" &&
          selectedPos.vendor_id === formData.vendor_id) ||
        (selectedPos.status === "assigned_merchant" &&
          selectedPos.merchant_id === formData.merchant_id &&
          selectedPos.vendor_id === formData.vendor_id);

      if (!canUsePos) {
        alert(
          "El POS seleccionado debe estar previamente asignado al vendedor del comercio o al mismo comercio."
        );
        return;
      }

      if (hasActiveInstallation(selectedPos.id)) {
        alert("El POS seleccionado ya tiene una instalación activa.");
        return;
      }
    }

    setLoading(true);

    const payload = {
      merchant_id: formData.merchant_id,
      vendor_id: formData.vendor_id || null,
      pos_id: formData.pos_id || null,
      status: formData.status,
      install_date: formData.install_date || null,
      notes: formData.notes || null,
    };

    const selectedMerchantName =
      merchants.find((m) => m.id === formData.merchant_id)?.name || null;

    const selectedVendorName =
      vendors.find((v) => v.id === formData.vendor_id)?.name || null;

    if (editingId) {
      const previousInstallation = installations.find((i) => i.id === editingId);

      const { error } = await supabase
        .from("installations")
        .update(payload)
        .eq("id", editingId);

      if (error) {
        setLoading(false);
        alert(`Error al editar instalación: ${error.message}`);
        console.error(error);
        return;
      }

      if (
        previousInstallation &&
        previousInstallation.status !== "cancelled" &&
        formData.status === "cancelled" &&
        previousInstallation.pos_id
      ) {
        const { error: posReleaseError } = await supabase
          .from("pos_devices")
          .update({
            status: "in_stock",
            merchant_id: null,
            vendor_id: null,
          })
          .eq("id", previousInstallation.pos_id);

        if (posReleaseError) {
          setLoading(false);
          alert(
            `La instalación se actualizó, pero falló la liberación del POS: ${posReleaseError.message}`
          );
          console.error(posReleaseError);
          await loadData();
          resetForm();
          return;
        }

        const releasedPos = posDevices.find(
          (p) => p.id === previousInstallation.pos_id
        );

        const { error: movementError } = await insertMovement({
          posId: previousInstallation.pos_id,
          posCode: releasedPos?.code || null,
          type: "retorno_stock",
          vendorId: null,
          vendorName:
            vendors.find((v) => v.id === previousInstallation.vendor_id)?.name ||
            null,
          merchantId: null,
          merchantName:
            merchants.find((m) => m.id === previousInstallation.merchant_id)?.name ||
            null,
          notes: "POS liberado por cancelación de instalación",
        });

        if (movementError) {
          setLoading(false);
          alert(
            `La instalación se canceló y el POS fue liberado, pero falló el movimiento: ${movementError.message}`
          );
          console.error(movementError);
          await loadData();
          resetForm();
          return;
        }
      }

      if (
        previousInstallation &&
        previousInstallation.status !== "completed" &&
        formData.status === "completed"
      ) {
        const { error: completedMovementError } = await insertMovement({
          posId: previousInstallation.pos_id,
          posCode: getPosCode(previousInstallation.pos_id),
          type: "instalacion_completada",
          vendorId: previousInstallation.vendor_id,
          vendorName:
            vendors.find((v) => v.id === previousInstallation.vendor_id)?.name ||
            null,
          merchantId: previousInstallation.merchant_id,
          merchantName:
            merchants.find((m) => m.id === previousInstallation.merchant_id)?.name ||
            null,
          notes: "Instalación marcada como completada",
        });

        if (completedMovementError) {
          setLoading(false);
          alert(
            `La instalación se actualizó, pero falló el movimiento de auditoría: ${completedMovementError.message}`
          );
          console.error(completedMovementError);
          await loadData();
          resetForm();
          return;
        }
      }

      setLoading(false);
      resetForm();
      await loadData();
      return;
    }

    const { error: installationError } = await supabase
      .from("installations")
      .insert([payload]);

    if (installationError) {
      setLoading(false);
      alert(`Error al guardar instalación: ${installationError.message}`);
      console.error(installationError);
      return;
    }

    const needsPosAssignment =
      selectedPos.status !== "assigned_merchant" ||
      selectedPos.merchant_id !== formData.merchant_id ||
      selectedPos.vendor_id !== formData.vendor_id;

    if (needsPosAssignment) {
      const { error: posUpdateError } = await supabase
        .from("pos_devices")
        .update({
          status: "assigned_merchant",
          merchant_id: formData.merchant_id,
          vendor_id: formData.vendor_id,
        })
        .eq("id", formData.pos_id);

      if (posUpdateError) {
        setLoading(false);
        alert(
          `La instalación se guardó, pero falló la asignación del POS: ${posUpdateError.message}`
        );
        console.error(posUpdateError);
        await loadData();
        resetForm();
        return;
      }

      const { error: assignMovementError } = await insertMovement({
        posId: formData.pos_id,
        posCode: selectedPos.code || null,
        type: "asignado_comercio",
        vendorId: formData.vendor_id || null,
        vendorName: selectedVendorName,
        merchantId: formData.merchant_id || null,
        merchantName: selectedMerchantName,
        notes: "Asignación desde instalaciones",
      });

      if (assignMovementError) {
        setLoading(false);
        alert(
          `La instalación y el POS se guardaron, pero falló el movimiento: ${assignMovementError.message}`
        );
        console.error(assignMovementError);
        await loadData();
        resetForm();
        return;
      }
    }

    if (formData.status === "completed") {
      const { error: completedMovementError } = await insertMovement({
        posId: formData.pos_id,
        posCode: selectedPos.code || null,
        type: "instalacion_completada",
        vendorId: formData.vendor_id || null,
        vendorName: selectedVendorName,
        merchantId: formData.merchant_id || null,
        merchantName: selectedMerchantName,
        notes: "Instalación creada directamente como completada",
      });

      if (completedMovementError) {
        setLoading(false);
        alert(
          `La instalación se guardó, pero falló la auditoría de instalación completada: ${completedMovementError.message}`
        );
        console.error(completedMovementError);
        await loadData();
        resetForm();
        return;
      }
    }

    setLoading(false);
    resetForm();
    await loadData();
    alert("Instalación guardada correctamente.");
  };

  const handleEdit = (installation: Installation) => {
    setEditingId(installation.id);
    setFormData({
      merchant_id: installation.merchant_id || "",
      vendor_id: installation.vendor_id || "",
      pos_id: installation.pos_id || "",
      status: installation.status || "pending",
      install_date: installation.install_date || "",
      notes: installation.notes || "",
    });
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm(
      "¿Seguro que querés eliminar esta instalación?"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("installations")
      .delete()
      .eq("id", id);

    if (error) {
      alert(`Error al eliminar instalación: ${error.message}`);
      console.error(error);
      return;
    }

    if (editingId === id) {
      resetForm();
    }

    await loadData();
  };

  const filteredInstallations = useMemo(() => {
    const text = search.trim().toLowerCase();

    return installations.filter((item) => {
      if (!text) return true;

      return (
        getMerchantName(item.merchant_id).toLowerCase().includes(text) ||
        getVendorName(item.vendor_id).toLowerCase().includes(text) ||
        getPosCode(item.pos_id).toLowerCase().includes(text) ||
        getStatusLabel(item.status).toLowerCase().includes(text) ||
        (item.notes || "").toLowerCase().includes(text) ||
        (item.install_date || "").toLowerCase().includes(text)
      );
    });
  }, [installations, search, merchants, vendors, posDevices]);

  const assignedMerchantPosList = formData.merchant_id
    ? getAssignedMerchantPosList(formData.merchant_id)
    : [];

  const eligiblePosList = getEligiblePosListForMerchant(
    formData.merchant_id,
    formData.vendor_id
  );
  const selectablePosList = getSelectablePosList();

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <h1 className="mb-6 text-3xl font-bold">Instalaciones</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold">
            {editingId ? "Editar instalación" : "Nueva instalación"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm">Comercio</label>
              <select
                className="w-full rounded-md border px-3 py-2"
                value={formData.merchant_id}
                onChange={(e) => handleChange("merchant_id", e.target.value)}
                disabled={!!editingId}
              >
                <option value="">Seleccionar comercio</option>
                {merchants.map((merchant) => (
                  <option key={merchant.id} value={merchant.id}>
                    {merchant.name || "Sin nombre"}
                  </option>
                ))}
              </select>
            </div>

            {formData.merchant_id && (
              <div className="space-y-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <p>Vendedor asignado: {getVendorName(formData.vendor_id)}</p>
                <p>
                  POS actualmente asignados al comercio:{" "}
                  {assignedMerchantPosList.length}
                </p>
                <p>POS elegibles para instalación: {eligiblePosList.length}</p>
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm">Vendedor</label>
              <select
                className="w-full rounded-md border px-3 py-2"
                value={formData.vendor_id}
                onChange={(e) => handleChange("vendor_id", e.target.value)}
                disabled={!!editingId}
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
              <label className="mb-1 block text-sm">
                {editingId ? "POS de la instalación" : "POS elegible"}
              </label>
              <select
                className="w-full rounded-md border px-3 py-2"
                value={formData.pos_id}
                onChange={(e) => handleChange("pos_id", e.target.value)}
                disabled={!!editingId}
              >
                <option value="">Seleccionar POS</option>
                {selectablePosList.map((pos) => (
                  <option key={pos.id} value={pos.id}>
                    {pos.code || "Sin código"}
                  </option>
                ))}
              </select>

              {!editingId && eligiblePosList.length === 0 && (
                <p className="mt-1 text-xs text-rose-600">
                  No hay POS elegibles para este comercio. El POS debe estar
                  previamente asignado al vendedor del comercio o al mismo
                  comercio.
                </p>
              )}

              {!editingId && formData.merchant_id && eligiblePosList.length > 0 && (
                <p className="mt-1 text-xs text-slate-500">
                  Se muestran solo POS del vendedor del comercio y también POS
                  ya asignados a este comercio que todavía no tengan instalación
                  activa.
                </p>
              )}

              {editingId && (
                <p className="mt-1 text-xs text-slate-500">
                  En edición podés cambiar estado, fecha y notas sin modificar
                  el POS asignado.
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm">Estado</label>
              <select
                className="w-full rounded-md border px-3 py-2"
                value={formData.status}
                onChange={(e) => handleChange("status", e.target.value)}
              >
                <option value="pending">Pendiente</option>
                <option value="in_progress">En proceso</option>
                <option value="completed">Completada</option>
                <option value="cancelled">Cancelada</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm">
                Fecha de instalación {formData.status === "completed" ? "*" : ""}
              </label>
              <input
                type="date"
                required={formData.status === "completed"}
                className="w-full rounded-md border px-3 py-2"
                value={formData.install_date}
                onChange={(e) => handleChange("install_date", e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm">Notas</label>
              <textarea
                className="w-full rounded-md border px-3 py-2"
                rows={4}
                value={formData.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
                placeholder="Detalle de la puesta en marcha..."
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading || (!editingId && eligiblePosList.length === 0)}
                className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
              >
                {loading
                  ? "Guardando..."
                  : editingId
                  ? "Actualizar instalación"
                  : "Guardar instalación"}
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
                {filteredInstallations.length} de {installations.length} instalaciones
              </p>
            </div>
          </div>

          <div className="mb-4 flex gap-2">
            <input
              type="text"
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por comercio, vendedor, POS, estado, fecha o nota..."
            />

            <button
              type="button"
              onClick={() => setSearch("")}
              className="whitespace-nowrap rounded-md border px-3 py-2 text-sm"
            >
              Limpiar
            </button>
          </div>

          {filteredInstallations.length === 0 ? (
            <p className="text-gray-500">
              {installations.length === 0
                ? "No hay instalaciones cargadas."
                : "No se encontraron instalaciones con esa búsqueda."}
            </p>
          ) : (
            <div className="max-h-[600px] flex-1 space-y-2 overflow-auto pr-2">
              {filteredInstallations.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-1 rounded-lg border p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">
                        {getMerchantName(item.merchant_id)}
                      </p>
                      <span
                        className={`mt-1 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getStatusClass(
                          item.status
                        )}`}
                      >
                        {getStatusLabel(item.status)}
                      </span>
                    </div>

                    <div className="flex shrink-0 gap-2">
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

                  <div className="text-xs text-gray-600">
                    <p>Vendedor: {getVendorName(item.vendor_id)}</p>
                    <p>POS: {getPosCode(item.pos_id)}</p>
                    <p>Fecha: {item.install_date || "-"}</p>
                    <p>Notas: {item.notes || "-"}</p>
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