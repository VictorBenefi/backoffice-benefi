"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

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

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 md:py-2.5";

export default function IncidenciasClient() {
  const supabase = useMemo(() => createClient(), []);

  const [formData, setFormData] = useState(initialForm);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [posDevices, setPosDevices] = useState<PosDevice[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingInitialData, setLoadingInitialData] = useState(true);

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
      toast.error(
        `Error al cargar incidencias: ${incRes.error.message}`
      );
    } else {
      setIncidents((incRes.data as Incident[]) || []);
    }

    if (merRes.error) {
      toast.error(
        `Error al cargar comercios: ${merRes.error.message}`
      );
    } else {
      setMerchants((merRes.data as Merchant[]) || []);
    }

    if (venRes.error) {
      toast.error(
        `Error al cargar vendedores: ${venRes.error.message}`
      );
    } else {
      setVendors((venRes.data as Vendor[]) || []);
    }

    if (posRes.error) {
      toast.error(
        `Error al cargar POS: ${posRes.error.message}`
      );
    } else {
      setPosDevices((posRes.data as PosDevice[]) || []);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      setLoadingInitialData(true);

      try {
        await loadData();
      } finally {
        setLoadingInitialData(false);
      }
    };

    loadInitialData();
  }, []);

  const getMerchantName = (merchantId: string | null) => {
    if (!merchantId) return "-";

    return (
      merchants.find(
        (merchant) => merchant.id === merchantId
      )?.name || "-"
    );
  };

  const getVendorName = (vendorId: string | null) => {
    if (!vendorId) return "-";

    return (
      vendors.find(
        (vendor) => vendor.id === vendorId
      )?.name || "-"
    );
  };

  const getPosCode = (posId: string | null) => {
    if (!posId) return "-";

    return (
      posDevices.find((pos) => pos.id === posId)?.code ||
      "-"
    );
  };

  const getMerchantPosList = (merchantId: string) => {
    return posDevices.filter(
      (pos) => pos.merchant_id === merchantId
    );
  };

  const merchantHasAssignedPos = (merchantId: string) => {
    return getMerchantPosList(merchantId).length > 0;
  };

  const handleMerchantChange = (merchantId: string) => {
    const selectedMerchant = merchants.find(
      (merchant) => merchant.id === merchantId
    );

    const merchantPosList =
      getMerchantPosList(merchantId);

    const firstPos = merchantPosList[0] || null;

    const resolvedVendorId =
      selectedMerchant?.vendor_id ||
      firstPos?.vendor_id ||
      "";

    setFormData((previous) => ({
      ...previous,
      merchant_id: merchantId,
      vendor_id: resolvedVendorId,
      pos_id: firstPos?.id || "",
    }));
  };

  const handlePosChange = (posId: string) => {
    const selectedPos = posDevices.find(
      (pos) => pos.id === posId
    );

    setFormData((previous) => ({
      ...previous,
      pos_id: posId,
      vendor_id:
        selectedPos?.vendor_id ||
        previous.vendor_id,
    }));
  };

  const handleChange = (
    field: keyof typeof initialForm,
    value: string
  ) => {
    if (field === "merchant_id" && !editingId) {
      handleMerchantChange(value);
      return;
    }

    if (field === "pos_id") {
      handlePosChange(value);
      return;
    }

    setFormData((previous) => ({
      ...previous,
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
        return "bg-rose-50 text-rose-700";
      case "in_progress":
        return "bg-blue-50 text-blue-700";
      case "resolved":
        return "bg-emerald-50 text-emerald-700";
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
        return "bg-amber-50 text-amber-700";
      case "high":
        return "bg-red-50 text-red-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const handleSubmit = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (!formData.merchant_id) {
      toast.warning("Debés seleccionar un comercio.");
      return;
    }

    if (
      !merchantHasAssignedPos(formData.merchant_id)
    ) {
      toast.warning(
        "El comercio seleccionado no tiene un POS asignado."
      );
      return;
    }

    if (!formData.pos_id) {
      toast.warning(
        "Debés seleccionar un POS del comercio."
      );
      return;
    }

    if (!formData.title.trim()) {
      toast.warning(
        "Debés ingresar un título para la incidencia."
      );
      return;
    }

    setLoading(true);

    const payload = {
      merchant_id: formData.merchant_id,
      vendor_id: formData.vendor_id || null,
      pos_id: formData.pos_id || null,
      title: formData.title.trim(),
      description:
        formData.description.trim() || null,
      status: formData.status,
      priority: formData.priority,
      resolved_at:
        formData.status === "resolved"
          ? new Date().toISOString()
          : null,
    };

    if (editingId) {
      const { error } = await supabase
        .from("incidents")
        .update(payload)
        .eq("id", editingId);

      setLoading(false);

      if (error) {
        toast.error(
          `Error al actualizar incidencia: ${error.message}`
        );
        return;
      }

      toast.success(
        "Incidencia actualizada correctamente."
      );

      resetForm();
      await loadData();
      return;
    }

    const { error } = await supabase
      .from("incidents")
      .insert([
        {
          ...payload,
          reported_at: new Date().toISOString(),
        },
      ]);

    setLoading(false);

    if (error) {
      toast.error(
        `Error al guardar incidencia: ${error.message}`
      );
      return;
    }

    toast.success(
      "Incidencia registrada correctamente."
    );

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

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm(
      "¿Seguro que querés eliminar esta incidencia? Esta acción no se puede deshacer."
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("incidents")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error(
        `Error al eliminar incidencia: ${error.message}`
      );
      return;
    }

    toast.success("Incidencia eliminada.");

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
        getMerchantName(item.merchant_id)
          .toLowerCase()
          .includes(text) ||
        getVendorName(item.vendor_id)
          .toLowerCase()
          .includes(text) ||
        getPosCode(item.pos_id)
          .toLowerCase()
          .includes(text) ||
        item.title.toLowerCase().includes(text) ||
        (item.description || "")
          .toLowerCase()
          .includes(text) ||
        getStatusLabel(item.status)
          .toLowerCase()
          .includes(text) ||
        getPriorityLabel(item.priority)
          .toLowerCase()
          .includes(text)
      );
    });
  }, [
    incidents,
    search,
    merchants,
    vendors,
    posDevices,
  ]);

  const merchantPosList = formData.merchant_id
    ? getMerchantPosList(formData.merchant_id)
    : [];

  const selectedMerchantHasPos =
    formData.merchant_id
      ? merchantPosList.length > 0
      : true;

  const selectedIncident = useMemo(() => {
    if (!editingId) return null;

    return (
      incidents.find(
        (incident) => incident.id === editingId
      ) || null
    );
  }, [editingId, incidents]);

  if (loadingInitialData) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 md:p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">
            Cargando incidencias...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen min-w-0 overflow-x-hidden bg-slate-50 p-4 md:p-6">
      {/* ENCABEZADO */}
      <div className="mb-5 md:mb-6">
        <h1 className="text-2xl font-bold text-slate-950 md:text-3xl">
          Incidencias y soporte
        </h1>

        <p className="mt-1 text-sm leading-6 text-slate-500 md:leading-normal">
          Registrá, administrá y resolvé problemas
          relacionados con los equipos POS instalados.
        </p>
      </div>

      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        {/* FORMULARIO */}
        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-4 md:px-6 md:py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-slate-950 md:text-xl">
                  {editingId
                    ? "Editar incidencia"
                    : "Nueva incidencia"}
                </h2>

                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {selectedIncident
                    ? `Estás modificando: ${selectedIncident.title}`
                    : "Completá los datos para registrar un nuevo caso de soporte."}
                </p>
              </div>

              {editingId && (
                <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                  Modo edición
                </span>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* SECCIÓN 1 */}
            <FormSection
              number="1"
              title="Comercio y equipo"
              description="Identificá el comercio y el equipo POS relacionado."
            >
              <div className="space-y-4">
                <Field label="Comercio">
                  <select
                    className={inputClass}
                    value={formData.merchant_id}
                    onChange={(event) =>
                      handleChange(
                        "merchant_id",
                        event.target.value
                      )
                    }
                    disabled={loading || Boolean(editingId)}
                  >
                    <option value="">
                      Seleccionar comercio
                    </option>

                    {merchants.map((merchant) => (
                      <option
                        key={merchant.id}
                        value={merchant.id}
                      >
                        {merchant.name || "Sin nombre"}
                      </option>
                    ))}
                  </select>
                </Field>

                {!selectedMerchantHasPos &&
                  formData.merchant_id && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                      <p className="text-sm font-semibold text-rose-800">
                        Comercio sin POS asignado
                      </p>

                      <p className="mt-1 text-xs leading-5 text-rose-700">
                        No se podrá registrar la incidencia
                        hasta que el comercio tenga un equipo
                        POS asignado.
                      </p>
                    </div>
                  )}

                <Field label="Vendedor">
                  <select
                    className={inputClass}
                    value={formData.vendor_id}
                    onChange={(event) =>
                      handleChange(
                        "vendor_id",
                        event.target.value
                      )
                    }
                    disabled={loading}
                  >
                    <option value="">
                      Seleccionar vendedor
                    </option>

                    {vendors.map((vendor) => (
                      <option
                        key={vendor.id}
                        value={vendor.id}
                      >
                        {vendor.name || "Sin nombre"}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Equipo POS">
                  <select
                    className={inputClass}
                    value={formData.pos_id}
                    onChange={(event) =>
                      handleChange(
                        "pos_id",
                        event.target.value
                      )
                    }
                    disabled={
                      loading ||
                      !formData.merchant_id ||
                      !selectedMerchantHasPos
                    }
                  >
                    <option value="">
                      Seleccionar POS
                    </option>

                    {merchantPosList.map((pos) => (
                      <option
                        key={pos.id}
                        value={pos.id}
                      >
                        {pos.code || "Sin código"}
                      </option>
                    ))}
                  </select>

                  {merchantPosList.length > 1 && (
                    <p className="mt-1.5 text-xs leading-5 text-slate-500">
                      Este comercio tiene{" "}
                      {merchantPosList.length} equipos
                      asignados. Seleccioná el correspondiente
                      a la incidencia.
                    </p>
                  )}
                </Field>
              </div>
            </FormSection>

            {/* SECCIÓN 2 */}
            <FormSection
              number="2"
              title="Detalle de la incidencia"
              description="Describí el problema informado por el comercio."
              bordered
            >
              <div className="space-y-4">
                <Field label="Título">
                  <input
                    type="text"
                    className={inputClass}
                    value={formData.title}
                    onChange={(event) =>
                      handleChange(
                        "title",
                        event.target.value
                      )
                    }
                    placeholder="Ej: POS no imprime ticket"
                    disabled={loading}
                  />
                </Field>

                <Field label="Descripción">
                  <textarea
                    className={`${inputClass} min-h-28 resize-y`}
                    rows={4}
                    value={formData.description}
                    onChange={(event) =>
                      handleChange(
                        "description",
                        event.target.value
                      )
                    }
                    placeholder="Detallá el reclamo, la falla detectada o las pruebas realizadas..."
                    disabled={loading}
                  />
                </Field>
              </div>
            </FormSection>

            {/* SECCIÓN 3 */}
            <FormSection
              number="3"
              title="Seguimiento"
              description="Definí el estado actual y la prioridad del caso."
              bordered
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Estado">
                  <select
                    className={inputClass}
                    value={formData.status}
                    onChange={(event) =>
                      handleChange(
                        "status",
                        event.target.value
                      )
                    }
                    disabled={loading}
                  >
                    <option value="open">
                      Abierta
                    </option>

                    <option value="in_progress">
                      En proceso
                    </option>

                    <option value="resolved">
                      Resuelta
                    </option>
                  </select>
                </Field>

                <Field label="Prioridad">
                  <select
                    className={inputClass}
                    value={formData.priority}
                    onChange={(event) =>
                      handleChange(
                        "priority",
                        event.target.value
                      )
                    }
                    disabled={loading}
                  >
                    <option value="low">
                      Baja
                    </option>

                    <option value="medium">
                      Media
                    </option>

                    <option value="high">
                      Alta
                    </option>
                  </select>
                </Field>
              </div>
            </FormSection>

            {/* ACCIONES */}
            <div className="border-t border-slate-200 bg-white px-4 py-3 md:px-6 md:py-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={
                    loading ||
                    !selectedMerchantHasPos
                  }
                  className="w-full rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
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
                    disabled={loading}
                    className="w-full rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          </form>
        </section>

        {/* LISTADO */}
        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-6">
          <div className="border-b border-slate-200 px-4 py-4 md:px-6 md:py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950 md:text-xl">
                  Incidencias registradas
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {filteredIncidents.length} de{" "}
                  {incidents.length} incidencias
                </p>
              </div>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                Total: {incidents.length}
              </span>
            </div>

            <div className="mt-4 flex min-w-0 flex-col gap-2 sm:flex-row">
              <input
                type="text"
                className={`${inputClass} min-w-0`}
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Buscar por comercio, POS, título, estado o prioridad..."
              />

              <button
                type="button"
                onClick={() => setSearch("")}
                className="w-full whitespace-nowrap rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto"
              >
                Limpiar
              </button>
            </div>
          </div>

          <div className="max-h-[calc(100vh-240px)] overflow-y-auto p-4">
            {filteredIncidents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
                <p className="text-sm text-slate-500">
                  {incidents.length === 0
                    ? "No hay incidencias registradas."
                    : "No se encontraron incidencias con esa búsqueda."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredIncidents.map((item) => {
                  const isSelected =
                    editingId === item.id;

                  return (
                    <article
                      key={item.id}
                      className={`rounded-xl border p-4 transition ${
                        isSelected
                          ? "border-blue-300 bg-blue-50/40 shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                      }`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h3 className="break-words font-semibold text-slate-950">
                            {item.title}
                          </h3>

                          <p className="mt-1 text-xs text-slate-500">
                            {getMerchantName(
                              item.merchant_id
                            )}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${getStatusClass(
                              item.status
                            )}`}
                          >
                            {getStatusLabel(item.status)}
                          </span>

                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${getPriorityClass(
                              item.priority
                            )}`}
                          >
                            Prioridad{" "}
                            {getPriorityLabel(
                              item.priority
                            )}
                          </span>
                        </div>
                      </div>

                      <dl className="mt-4 grid gap-2 text-xs">
                        <IncidentDetail
                          label="Vendedor"
                          value={getVendorName(
                            item.vendor_id
                          )}
                        />

                        <IncidentDetail
                          label="POS"
                          value={getPosCode(item.pos_id)}
                        />

                        <IncidentDetail
                          label="Reportada"
                          value={formatDateTime(
                            item.reported_at ||
                              item.created_at
                          )}
                        />

                        {item.resolved_at && (
                          <IncidentDetail
                            label="Resuelta"
                            value={formatDateTime(
                              item.resolved_at
                            )}
                          />
                        )}
                      </dl>

                      <div className="mt-4 rounded-lg bg-slate-50 p-3">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                          Descripción
                        </p>

                        <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-slate-700">
                          {item.description ||
                            "Sin descripción registrada."}
                        </p>
                      </div>

                      <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row">
                        <button
                          type="button"
                          onClick={() =>
                            handleEdit(item)
                          }
                          className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 sm:w-auto"
                        >
                          {isSelected
                            ? "Editando"
                            : "Editar"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleDelete(item.id)
                          }
                          className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 sm:w-auto"
                        >
                          Eliminar
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function FormSection({
  number,
  title,
  description,
  bordered = false,
  children,
}: {
  number: string;
  title: string;
  description: string;
  bordered?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`px-4 py-5 md:px-6 md:py-6 ${
        bordered
          ? "border-t border-slate-200"
          : ""
      }`}
    >
      <div className="mb-4 flex items-start gap-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white md:h-8 md:w-8 md:text-sm">
          {number}
        </div>

        <div>
          <h3 className="text-base font-semibold text-slate-950 md:text-lg">
            {title}
          </h3>

          <p className="mt-1 text-xs leading-5 text-slate-500 md:text-sm">
            {description}
          </p>
        </div>
      </div>

      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>

      {children}
    </div>
  );
}

function IncidentDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-slate-400">{label}</dt>

      <dd className="max-w-[68%] break-words text-right font-medium text-slate-700">
        {value}
      </dd>
    </div>
  );
}

function formatDateTime(value: string | null) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}