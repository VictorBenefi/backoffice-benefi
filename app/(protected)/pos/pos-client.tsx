"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";

type PosDevice = {
  id: string;
  code: string | null;
  brand: string | null;
  model: string | null;
  serial: string | null;
  imei: string | null;
  imei_2: string | null;
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
  const [posDevices, setPosDevices] = useState<PosDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [search, setSearch] = useState("");

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

      if (merchantIds.length === 0) {
        setPosDevices([]);
        return;
      }

      const { data, error } = await supabase
        .from("pos_devices")
        .select("id, code, brand, model, serial, imei, imei_2, created_at")
        .in("merchant_id", merchantIds)
        .order("created_at", { ascending: false });

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
      .select("id, code, brand, model, serial, imei, imei_2, created_at")
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
        setPageLoading(false);
        return;
      }

      setCurrentUserId(user.id);

      const role = await loadCurrentRole(user.id);
      await loadPosDevices(user.id, role);

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

  const reloadPos = async () => {
    if (!currentUserId) return;
    await loadPosDevices(currentUserId, currentRole);
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

    await reloadPos();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;
    if (!validateDuplicates()) return;

    setLoading(true);

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

      setLoading(false);

      if (error) {
        alert(`Error al editar POS: ${error.message}`);
        console.error(error);
        return;
      }

      resetForm();
      await reloadPos();
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

    setLoading(false);

    if (error) {
      alert(`Error al guardar POS: ${error.message}`);
      console.error(error);
      return;
    }

    resetForm();
    await reloadPos();
  };

  const filteredPosDevices = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return posDevices.filter((pos) => {
      return (
        !searchText ||
        (pos.code || "").toLowerCase().includes(searchText) ||
        (pos.brand || "").toLowerCase().includes(searchText) ||
        (pos.model || "").toLowerCase().includes(searchText) ||
        (pos.serial || "").toLowerCase().includes(searchText) ||
        (pos.imei || "").toLowerCase().includes(searchText) ||
        (pos.imei_2 || "").toLowerCase().includes(searchText)
      );
    });
  }, [posDevices, search]);

  const clearFilters = () => {
    setSearch("");
  };

  const handleExportExcel = () => {
    const exportData = filteredPosDevices.map((pos) => ({
      Codigo: pos.code || "",
      Marca: pos.brand || "",
      Modelo: pos.model || "",
      Serial: pos.serial || "",
      "IMEI 1": pos.imei || "",
      "IMEI 2": pos.imei_2 || "",
      "Fecha alta": pos.created_at
        ? new Date(pos.created_at).toLocaleString("es-AR")
        : "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "POS");
    XLSX.writeFile(workbook, "listado_pos.xlsx");
  };

  if (pageLoading) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <h1 className="mb-6 text-3xl font-bold">POS / Terminales</h1>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-gray-500">Cargando POS...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <h1 className="mb-6 text-3xl font-bold">POS / Terminales</h1>

      <div
        className={`grid gap-6 ${
          isVendor ? "grid-cols-1" : "md:grid-cols-[420px_1fr]"
        }`}
      >
        {!isVendor && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-2 text-xl font-semibold">
              {editingId ? "Editar POS" : "Nuevo POS"}
            </h2>

            <p className="mb-4 text-sm text-slate-500">
              Este módulo es solo para alta y edición técnica del equipo. Las
              asignaciones y cambios de estado se realizan únicamente desde el
              módulo Asignaciones.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm">Código interno</label>
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
                <label className="mb-1 block text-sm">Marca</label>
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
                <label className="mb-1 block text-sm">Modelo</label>
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
                <label className="mb-1 block text-sm">Serial</label>
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
                <label className="mb-1 block text-sm">IMEI 1</label>
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
                <label className="mb-1 block text-sm">IMEI 2</label>
                <input
                  type="text"
                  className="w-full rounded-md border px-3 py-2"
                  value={formData.imei_2}
                  onChange={(e) => handleChange("imei_2", e.target.value)}
                  placeholder="Ej: 987654321098765"
                />
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
        )}

        <section className="flex h-[850px] flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                {isVendor ? "Mis POS asignados" : "Listado"}
              </h2>
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

          <div
            className={`mb-4 grid gap-3 ${
              isVendor ? "md:grid-cols-2" : "md:grid-cols-3"
            }`}
          >
            <input
              type="text"
              placeholder="Buscar por código, serial, IMEI..."
              className="rounded-md border px-3 py-2 text-sm md:col-span-2"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <button
              type="button"
              onClick={clearFilters}
              className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50"
            >
              Limpiar filtros
            </button>
          </div>

          {filteredPosDevices.length === 0 ? (
            <p className="text-gray-500">
              {isVendor
                ? "No tenés POS asignados en este momento."
                : "No hay POS para mostrar."}
            </p>
          ) : (
            <div className="flex-1 overflow-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-100">
                  <tr className="text-left">
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Marca</th>
                    <th className="px-4 py-3">Modelo</th>
                    <th className="px-4 py-3">Serial</th>
                    <th className="px-4 py-3">IMEI 1</th>
                    <th className="px-4 py-3">IMEI 2</th>
                    {!isVendor && <th className="px-4 py-3">Acciones</th>}
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
                      {!isVendor && (
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
                      )}
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