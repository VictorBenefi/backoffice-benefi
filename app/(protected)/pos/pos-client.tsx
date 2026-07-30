"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import NotificationBanner, {
  type NotificationMessage,
} from "@/components/ui/NotificationBanner";
import ConfirmModal from "@/components/ui/ConfirmModal";
import {
  DangerButton,
  EmptyState,
  FormCard,
  PageHeader,
  PrimaryButton,
  SearchToolbar,
  SecondaryButton,
  StatusBadge,
  fieldClassName,
  labelClassName,
} from "@/components/ui";

type Vendor = {
  id: string;
  name: string | null;
};

type Merchant = {
  id: string;
  name: string | null;
  vendor_id: string | null;
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

type Installation = {
  id: string;
  pos_id: string | null;
  status: string;
  install_date: string | null;
  created_at: string;
};

const initialForm = {
  code: "",
  brand: "",
  model: "",
  serial: "",
  imei: "",
  imei_2: "",
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
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [posDevices, setPosDevices] = useState<PosDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [message, setMessage] =
    useState<NotificationMessage | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [posToDelete, setPosToDelete] = useState<PosDevice | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isVendor = currentRole === "vendedor";

  const getCurrentUser = async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error("Error obteniendo usuario actual:", error.message);
      return null;
    }

    return user;
  };

  const loadCurrentRole = async (userId: string) => {
    const { data, error } = await supabase
      .from("app_users")
      .select("role")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error al cargar rol actual:", error.message);
      setCurrentRole(null);
      return null;
    }

    const role = data?.role || null;
    setCurrentRole(role);
    return role;
  };

  const loadVendors = async () => {
    const { data, error } = await supabase
      .from("vendors")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error al cargar vendedores:", error.message);
      setVendors([]);
      return;
    }

    setVendors((data as Vendor[]) || []);
  };

  const loadMerchants = async () => {
    const { data, error } = await supabase
      .from("merchants")
      .select("id, name, vendor_id")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error al cargar comercios:", error.message);
      setMerchants([]);
      return;
    }

    setMerchants((data as Merchant[]) || []);
  };

  const loadInstallations = async () => {
    const { data, error } = await supabase
      .from("installations")
      .select("id, pos_id, status, install_date, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error al cargar instalaciones:", error.message);
      setInstallations([]);
      return;
    }

    setInstallations((data as Installation[]) || []);
  };

  const loadPosDevices = async (userId: string, role?: string | null) => {
    const effectiveRole = role ?? currentRole;

    if (effectiveRole === "vendedor") {
      const { data: vendor, error: vendorError } = await supabase
        .from("vendors")
        .select("id")
        .eq("auth_user_id", userId)
        .maybeSingle();

      if (vendorError) {
        console.error("Error al obtener vendedor:", vendorError.message);
        setPosDevices([]);
        return;
      }

      if (!vendor?.id) {
        setPosDevices([]);
        return;
      }

      const { data: merchantRows, error: merchantError } = await supabase
        .from("merchants")
        .select("id")
        .eq("vendor_id", vendor.id);

      if (merchantError) {
        console.error(
          "Error al obtener comercios del vendedor:",
          merchantError.message
        );
        setPosDevices([]);
        return;
      }

      const merchantIds = merchantRows?.map((m) => m.id) || [];

      let query = supabase
        .from("pos_devices")
        .select(
          "id, code, brand, model, serial, imei, imei_2, status, vendor_id, merchant_id, created_at"
        )
        .order("created_at", { ascending: false });

      if (merchantIds.length > 0) {
        const merchantFilter = merchantIds
          .map((id) => `merchant_id.eq.${id}`)
          .join(",");
        query = query.or(`vendor_id.eq.${vendor.id},${merchantFilter}`);
      } else {
        query = query.eq("vendor_id", vendor.id);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error al cargar POS del vendedor:", error.message);
        setPosDevices([]);
        return;
      }

      setPosDevices((data as PosDevice[]) || []);
      return;
    }

    const { data, error } = await supabase
      .from("pos_devices")
      .select(
        "id, code, brand, model, serial, imei, imei_2, status, vendor_id, merchant_id, created_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error al cargar POS:", error.message);
      setPosDevices([]);
      return;
    }

    setPosDevices((data as PosDevice[]) || []);
  };

  useEffect(() => {
    const init = async () => {
      setPageLoading(true);

      const user = await getCurrentUser();

      if (!user?.id) {
        setCurrentRole(null);
        setCurrentUserId(null);
        setPosDevices([]);
        setInstallations([]);
        setPageLoading(false);
        return;
      }

      setCurrentUserId(user.id);

      const role = await loadCurrentRole(user.id);

      await Promise.all([
        loadPosDevices(user.id, role),
        loadVendors(),
        loadMerchants(),
        loadInstallations(),
      ]);

      setPageLoading(false);
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setMessage({
        type: "warning",
        text: "Debés completar el Código interno.",
      });
      return false;
    }

    if (!formData.brand.trim()) {
      setMessage({
        type: "warning",
        text: "Debés completar la Marca.",
      });
      return false;
    }

    if (!formData.model.trim()) {
      setMessage({
        type: "warning",
        text: "Debés completar el Modelo.",
      });
      return false;
    }

    if (!formData.serial.trim()) {
      setMessage({
        type: "warning",
        text: "Debés completar el Serial.",
      });
      return false;
    }

    if (!formData.imei.trim()) {
      setMessage({
        type: "warning",
        text: "Debés completar el IMEI 1.",
      });
      return false;
    }

    return true;
  };

  const validateDuplicates = () => {
    const code = normalize(formData.code);
    const serial = normalize(formData.serial);
    const imei = normalize(formData.imei);
    const imei2 = normalize(formData.imei_2);

    for (const pos of posDevices) {
      if (editingId && pos.id === editingId) continue;

      const posCode = normalize(pos.code);
      const posSerial = normalize(pos.serial);
      const posImei = normalize(pos.imei);
      const posImei2 = normalize(pos.imei_2);

      if (code && posCode === code) {
        setMessage({
          type: "warning",
          text: "Ya existe un POS con ese Código interno.",
        });
        return false;
      }

      if (serial && posSerial === serial) {
        setMessage({
          type: "warning",
          text: "Ya existe un POS con ese Serial.",
        });
        return false;
      }

      if (imei && (posImei === imei || posImei2 === imei)) {
        setMessage({
          type: "warning",
          text: "Ya existe un POS con ese IMEI 1.",
        });
        return false;
      }

      if (imei2 && (posImei === imei2 || posImei2 === imei2)) {
        setMessage({
          type: "warning",
          text: "Ya existe un POS con ese IMEI 2.",
        });
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

  const getLatestInstallationForPos = (posId: string) => {
    return installations.find((installation) => installation.pos_id === posId) || null;
  };

  const getInstallationStatusLabel = (status: string | null) => {
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
        return "-";
    }
  };

  const getInstallationStatusClass = (status: string | null) => {
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

  const reloadPos = async () => {
    if (!currentUserId) return;
    await Promise.all([
      loadPosDevices(currentUserId, currentRole),
      loadInstallations(),
    ]);
  };

  const handleEdit = (pos: PosDevice) => {
    setMessage(null);
    setEditingId(pos.id);
    setFormData({
      code: pos.code || "",
      brand: pos.brand || "",
      model: pos.model || "",
      serial: pos.serial || "",
      imei: pos.imei || "",
      imei_2: pos.imei_2 || "",
    });

    window.requestAnimationFrame(() => {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    });
  };

  const requestDelete = (pos: PosDevice) => {
    setMessage(null);
    setPosToDelete(pos);
    setDeleteModalOpen(true);
  };

  const cancelDelete = () => {
    if (deleting) return;

    setDeleteModalOpen(false);
    setPosToDelete(null);
  };

  const confirmDelete = async () => {
    if (!posToDelete) return;

    setDeleting(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from("pos_devices")
        .delete()
        .eq("id", posToDelete.id);

      if (error) {
        throw new Error(`Error al eliminar POS: ${error.message}`);
      }

      if (editingId === posToDelete.id) {
        resetForm();
      }

      await reloadPos();

      setDeleteModalOpen(false);
      setPosToDelete(null);
      setMessage({
        type: "success",
        text: "POS eliminado correctamente.",
      });
    } catch (error) {
      console.error(error);
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "No se pudo eliminar el POS.",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);

    if (!validateForm()) return;
    if (!validateDuplicates()) return;

    setLoading(true);

    try {
      if (editingId) {
        const { error } = await supabase
          .from("pos_devices")
          .update({
            code: formData.code.trim(),
            brand: formData.brand.trim(),
            model: formData.model.trim(),
            serial: formData.serial.trim(),
            imei: formData.imei.trim(),
            imei_2: formData.imei_2.trim() || null,
          })
          .eq("id", editingId);

        if (error) {
          throw new Error(`Error al editar POS: ${error.message}`);
        }

        resetForm();
        await reloadPos();

        setMessage({
          type: "success",
          text: "POS actualizado correctamente.",
        });
        return;
      }

      const { error } = await supabase.from("pos_devices").insert([
        {
          code: formData.code.trim(),
          brand: formData.brand.trim(),
          model: formData.model.trim(),
          serial: formData.serial.trim(),
          imei: formData.imei.trim(),
          imei_2: formData.imei_2.trim() || null,
        },
      ]);

      if (error) {
        throw new Error(`Error al guardar POS: ${error.message}`);
      }

      resetForm();
      await reloadPos();

      setMessage({
        type: "success",
        text: "POS guardado correctamente.",
      });
    } catch (error) {
      console.error(error);

      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "No se pudo guardar el POS.",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredPosDevices = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return posDevices.filter((pos) => {
      const latestInstallation = getLatestInstallationForPos(pos.id);
      const installationLabel = getInstallationStatusLabel(
        latestInstallation?.status || null
      ).toLowerCase();

      return (
        !searchText ||
        (pos.code || "").toLowerCase().includes(searchText) ||
        (pos.brand || "").toLowerCase().includes(searchText) ||
        (pos.model || "").toLowerCase().includes(searchText) ||
        (pos.serial || "").toLowerCase().includes(searchText) ||
        (pos.imei || "").toLowerCase().includes(searchText) ||
        (pos.imei_2 || "").toLowerCase().includes(searchText) ||
        getVendorName(pos.vendor_id).toLowerCase().includes(searchText) ||
        getMerchantName(pos.merchant_id).toLowerCase().includes(searchText) ||
        getStatusLabel(pos.status).toLowerCase().includes(searchText) ||
        installationLabel.includes(searchText)
      );
    });
  }, [posDevices, search, vendors, merchants, installations]);

  const clearFilters = () => {
    setSearch("");
  };

  const handleExportExcel = () => {
    const exportData = filteredPosDevices.map((pos) => {
      const latestInstallation = getLatestInstallationForPos(pos.id);

      return {
        Codigo: pos.code || "",
        Marca: pos.brand || "",
        Modelo: pos.model || "",
        Serial: pos.serial || "",
        "IMEI 1": pos.imei || "",
        "IMEI 2": pos.imei_2 || "",
        Estado: getStatusLabel(pos.status),
        Instalacion: getInstallationStatusLabel(latestInstallation?.status || null),
        "Fecha instalacion": latestInstallation?.install_date || "",
        Vendedor: getVendorName(pos.vendor_id),
        Comercio: getMerchantName(pos.merchant_id),
        "Fecha alta": pos.created_at
          ? new Date(pos.created_at).toLocaleString("es-AR")
          : "",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "POS");
    XLSX.writeFile(workbook, "listado_pos.xlsx");
  };

  const getStatusTone = (
    status: string | null
  ):
    | "neutral"
    | "info"
    | "success"
    | "warning"
    | "danger"
    | "violet"
    | "teal" => {
    switch (status) {
      case "in_stock":
        return "success";
      case "assigned_vendor":
        return "info";
      case "assigned_merchant":
        return "violet";
      case "installed":
        return "teal";
      case "maintenance":
        return "warning";
      case "inactive":
        return "danger";
      default:
        return "neutral";
    }
  };

  const getInstallationTone = (
    status: string | null
  ): "neutral" | "info" | "success" | "warning" | "danger" => {
    switch (status) {
      case "pending":
        return "warning";
      case "in_progress":
        return "info";
      case "completed":
        return "success";
      case "cancelled":
        return "danger";
      default:
        return "neutral";
    }
  };

  if (pageLoading) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-7xl">
          <PageHeader
            title="POS / Terminales"
            description="Gestioná el inventario técnico y consultá el estado operativo de los equipos."
          />

          <FormCard>
            <p className="text-sm text-slate-500">Cargando POS...</p>
          </FormCard>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-[1800px]">
        <PageHeader
          title="POS / Terminales"
          description="Gestioná el inventario técnico y consultá el estado operativo de los equipos."
        />

        <NotificationBanner
          message={message}
          onClose={() => setMessage(null)}
          className="mb-5"
        />

        <div
          className={`grid gap-6 ${
            isVendor
              ? "grid-cols-1"
              : "xl:grid-cols-[minmax(360px,0.8fr)_minmax(0,2.2fr)]"
          }`}
        >
          {!isVendor ? (
            <FormCard
              title={editingId ? "Editar POS" : "Nuevo POS"}
              description="Este módulo es únicamente para el alta y la edición técnica. Las asignaciones y los cambios de estado se gestionan desde Asignaciones."
            >
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className={labelClassName}>Código interno</label>
                  <input
                    type="text"
                    required
                    className={fieldClassName}
                    value={formData.code}
                    onChange={(event) =>
                      handleChange("code", event.target.value)
                    }
                    placeholder="Ej: POS-001"
                    disabled={loading}
                  />
                </div>

                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  <div>
                    <label className={labelClassName}>Marca</label>
                    <input
                      type="text"
                      required
                      className={fieldClassName}
                      value={formData.brand}
                      onChange={(event) =>
                        handleChange("brand", event.target.value)
                      }
                      placeholder="Ej: UROVO"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className={labelClassName}>Modelo</label>
                    <input
                      type="text"
                      required
                      className={fieldClassName}
                      value={formData.model}
                      onChange={(event) =>
                        handleChange("model", event.target.value)
                      }
                      placeholder="Ej: i9100"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClassName}>Serial</label>
                  <input
                    type="text"
                    required
                    className={fieldClassName}
                    value={formData.serial}
                    onChange={(event) =>
                      handleChange("serial", event.target.value)
                    }
                    placeholder="Ej: SRL123456"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className={labelClassName}>IMEI 1</label>
                  <input
                    type="text"
                    required
                    className={fieldClassName}
                    value={formData.imei}
                    onChange={(event) =>
                      handleChange("imei", event.target.value)
                    }
                    placeholder="Ej: 123456789012345"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className={labelClassName}>IMEI 2</label>
                  <input
                    type="text"
                    className={fieldClassName}
                    value={formData.imei_2}
                    onChange={(event) =>
                      handleChange("imei_2", event.target.value)
                    }
                    placeholder="Opcional"
                    disabled={loading}
                  />
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row">
                  <PrimaryButton
                    type="submit"
                    loading={loading}
                    loadingLabel="Guardando..."
                  >
                    {editingId ? "Actualizar POS" : "Guardar POS"}
                  </PrimaryButton>

                  {editingId ? (
                    <SecondaryButton
                      type="button"
                      onClick={resetForm}
                      disabled={loading}
                    >
                      Cancelar edición
                    </SecondaryButton>
                  ) : null}
                </div>
              </form>
            </FormCard>
          ) : null}

          <FormCard
            title={isVendor ? "Mis POS asignados" : "Listado de POS"}
            description={`${filteredPosDevices.length} de ${posDevices.length} equipos`}
            className="min-w-0"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1">
                <SearchToolbar
                  value={search}
                  onChange={setSearch}
                  onClear={clearFilters}
                  placeholder="Buscar por código, serial, IMEI, vendedor, comercio, estado o instalación..."
                />
              </div>

              <PrimaryButton
                type="button"
                onClick={handleExportExcel}
                className="shrink-0"
              >
                Exportar Excel
              </PrimaryButton>
            </div>

            <div className="mt-5">
              {filteredPosDevices.length === 0 ? (
                <EmptyState
                  title={
                    isVendor
                      ? "No tenés POS asignados"
                      : "No hay POS para mostrar"
                  }
                  description={
                    isVendor
                      ? "Cuando te asignen equipos, aparecerán en este listado."
                      : "Los equipos que registres aparecerán en este listado."
                  }
                />
              ) : (
                <div className="max-h-[760px] overflow-auto rounded-xl border border-slate-200">
                  <table className="min-w-[1120px] w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-100">
                      <tr className="text-left text-slate-700">
                        <th className="px-4 py-3 font-semibold">Código</th>
                        <th className="px-4 py-3 font-semibold">Equipo</th>
                        <th className="px-4 py-3 font-semibold">Identificadores</th>
                        <th className="px-4 py-3 font-semibold">Estado</th>
                        <th className="px-4 py-3 font-semibold">Asignación</th>
                        {!isVendor ? (
                          <th className="px-4 py-3 font-semibold">Acciones</th>
                        ) : null}
                      </tr>
                    </thead>

                    <tbody>
                      {filteredPosDevices.map((pos) => {
                        const latestInstallation =
                          getLatestInstallationForPos(pos.id);

                        return (
                          <tr
                            key={pos.id}
                            className="border-t border-slate-200 align-top transition hover:bg-slate-50"
                          >
                            <td className="px-4 py-4">
                              <p className="font-semibold text-slate-900">
                                {pos.code || "-"}
                              </p>
                            </td>

                            <td className="px-4 py-4">
                              <p className="font-medium text-slate-900">
                                {[pos.brand, pos.model]
                                  .filter(Boolean)
                                  .join(" ") || "-"}
                              </p>
                            </td>

                            <td className="px-4 py-4">
                              <div className="space-y-3 text-xs">
                                <div className="grid grid-cols-[56px_1fr] gap-2">
                                  <span className="font-semibold text-slate-500">
                                    Serial
                                  </span>

                                  <span className="font-mono text-slate-800">
                                    {pos.serial || "-"}
                                  </span>
                                </div>

                                <div className="grid grid-cols-[56px_1fr] gap-2">
                                  <span className="font-semibold text-slate-500">
                                    IMEI 1
                                  </span>

                                  <span className="font-mono text-slate-800">
                                    {pos.imei || "-"}
                                  </span>
                                </div>

                                <div className="grid grid-cols-[56px_1fr] gap-2">
                                  <span className="font-semibold text-slate-500">
                                    IMEI 2
                                  </span>

                                  <span className="font-mono text-slate-800">
                                    {pos.imei_2 || "-"}
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-4">
                              <div className="flex flex-col items-start gap-2">
                                <StatusBadge
                                  label={getStatusLabel(pos.status)}
                                  tone={getStatusTone(pos.status)}
                                />

                                <StatusBadge
                                  label={getInstallationStatusLabel(
                                    latestInstallation?.status || null
                                  )}
                                  tone={getInstallationTone(
                                    latestInstallation?.status || null
                                  )}
                                />
                              </div>
                            </td>

                            <td className="px-4 py-4">
                              <div className="space-y-1 text-sm text-slate-700">
                                <p>
                                  <span className="font-semibold text-slate-500">
                                    Vendedor:
                                  </span>{" "}
                                  {getVendorName(pos.vendor_id)}
                                </p>

                                <p>
                                  <span className="font-semibold text-slate-500">
                                    Comercio:
                                  </span>{" "}
                                  {getMerchantName(pos.merchant_id)}
                                </p>
                              </div>
                            </td>

                            {!isVendor ? (
                              <td className="px-4 py-4">
                                <div className="flex flex-wrap gap-2">
                                  <SecondaryButton
                                    type="button"
                                    onClick={() => handleEdit(pos)}
                                    className="px-3 py-2 text-xs"
                                  >
                                    Editar
                                  </SecondaryButton>

                                  {canDeletePos ? (
                                    <DangerButton
                                      type="button"
                                      onClick={() => requestDelete(pos)}
                                      className="px-3 py-2 text-xs"
                                    >
                                      Eliminar
                                    </DangerButton>
                                  ) : null}
                                </div>
                              </td>
                            ) : null}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </FormCard>
        </div>
      </div>

      <ConfirmModal
        open={deleteModalOpen}
        title="Eliminar POS"
        description={
          posToDelete
            ? `¿Confirmás eliminar el POS ${
                posToDelete.code || "sin código"
              }? Esta acción no se puede deshacer.`
            : "¿Confirmás eliminar este POS?"
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </main>
  );
}