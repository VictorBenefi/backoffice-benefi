"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import NotificationBanner, {
  type NotificationMessage,
} from "@/components/ui/NotificationBanner";
import {
  EmptyState,
  FormCard,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  StatusBadge,
  fieldClassName,
} from "@/components/ui";

type Movement = {
  id: string;
  type: string;
  pos_id: string;
  pos_code: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
  merchant_id: string | null;
  merchant_name: string | null;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  user_role: string | null;
  notes: string | null;
  created_at: string;
};

export default function MovimientosPage() {
  const supabase = createClient();

  const [movements, setMovements] = useState<Movement[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [message, setMessage] =
    useState<NotificationMessage | null>(null);

  const loadMovements = async () => {
    const { data, error } = await supabase
      .from("pos_movements")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error cargando movimientos:", error.message);
      setMessage({
        type: "error",
        text: `No se pudieron cargar los movimientos: ${error.message}`,
      });
      return;
    }

    setMovements(data || []);
  };

  useEffect(() => {
    loadMovements();
  }, []);

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "ingreso_stock":
        return "Ingreso a stock";
      case "retorno_stock":
        return "Retorno a stock";
      case "asignado_comercio":
        return "Asignado a comercio";
      case "asignado_vendedor":
        return "Asignado a vendedor";
      case "mantenimiento":
        return "Mantenimiento";
      case "baja":
        return "Baja";
      case "instalacion_completada":
        return "Instalación completada";
      default:
        return type;
    }
  };

  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase();

    return movements.filter((m) => {
      const matchesSearch =
        !text ||
        (m.type || "").toLowerCase().includes(text) ||
        getTypeLabel(m.type || "").toLowerCase().includes(text) ||
        (m.notes || "").toLowerCase().includes(text) ||
        (m.pos_code || "").toLowerCase().includes(text) ||
        (m.vendor_name || "").toLowerCase().includes(text) ||
        (m.merchant_name || "").toLowerCase().includes(text) ||
        (m.user_name || "").toLowerCase().includes(text) ||
        (m.user_email || "").toLowerCase().includes(text) ||
        (m.user_role || "").toLowerCase().includes(text);

      const matchesType = !typeFilter || m.type === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [movements, search, typeFilter]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("es-AR");
  };

  const getExportFileName = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `movimientos_pos_${dd}-${mm}-${yyyy}.xlsx`;
  };

  const handleExportExcel = () => {
    setMessage(null);

    if (filtered.length === 0) {
      setMessage({
        type: "warning",
        text: "No hay movimientos para exportar.",
      });
      return;
    }

    const exportData = filtered.map((movement) => ({
      Fecha: formatDate(movement.created_at),
      Tipo: getTypeLabel(movement.type),
      "Código POS": movement.pos_code || "-",
      Vendedor: movement.vendor_name || "-",
      Comercio: movement.merchant_name || "-",
      Usuario: movement.user_name || "-",
      "Email usuario": movement.user_email || "-",
      Rol: movement.user_role || "-",
      Nota: movement.notes || "-",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Movimientos");

    XLSX.writeFile(workbook, getExportFileName());

    setMessage({
      type: "success",
      text: "El archivo Excel se exportó correctamente.",
    });
  };

  const totalStockEntries = movements.filter(
    (movement) => movement.type === "ingreso_stock"
  ).length;

  const totalCompletedInstallations = movements.filter(
    (movement) => movement.type === "instalacion_completada"
  ).length;

  const totalMaintenance = movements.filter(
    (movement) => movement.type === "mantenimiento"
  ).length;

  const getMovementTone = (
    type: string
  ):
    | "neutral"
    | "info"
    | "success"
    | "warning"
    | "danger"
    | "violet"
    | "teal" => {
    switch (type) {
      case "ingreso_stock":
      case "retorno_stock":
        return "success";
      case "asignado_vendedor":
        return "info";
      case "asignado_comercio":
        return "violet";
      case "instalacion_completada":
        return "teal";
      case "mantenimiento":
        return "warning";
      case "baja":
        return "danger";
      default:
        return "neutral";
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-3 sm:p-4 lg:p-6">
      <div className="mx-auto max-w-[1800px]">
        <PageHeader
          title="Movimientos de POS"
          description="Historial operativo de todas las acciones realizadas sobre los equipos POS."
        />

        <NotificationBanner
          message={message}
          onClose={() => setMessage(null)}
          className="mb-5"
        />

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Movimientos totales
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {movements.length}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Ingresos a stock
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {totalStockEntries}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Instalaciones completadas
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {totalCompletedInstallations}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Enviados a mantenimiento
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {totalMaintenance}
            </p>
          </div>
        </div>

        <FormCard
          title="Historial operativo"
          description={`${filtered.length} movimientos de ${movements.length} totales`}
        >
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="min-w-0 flex-1">
              <input
                type="text"
                placeholder="Buscar por POS, vendedor, comercio, usuario, rol o nota..."
                className={fieldClassName}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <div className="xl:w-[320px]">
              <select
                className={fieldClassName}
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
              >
                <option value="">Todos los movimientos</option>
                <option value="ingreso_stock">Ingreso a stock</option>
                <option value="retorno_stock">Retorno a stock</option>
                <option value="asignado_comercio">
                  Asignado a comercio
                </option>
                <option value="asignado_vendedor">
                  Asignado a vendedor
                </option>
                <option value="mantenimiento">Mantenimiento</option>
                <option value="baja">Baja</option>
                <option value="instalacion_completada">
                  Instalación completada
                </option>
              </select>
            </div>

            <SecondaryButton
              type="button"
              onClick={() => {
                setSearch("");
                setTypeFilter("");
              }}
              disabled={!search && !typeFilter}
              className="shrink-0"
            >
              Limpiar filtros
            </SecondaryButton>

            <PrimaryButton
              type="button"
              onClick={handleExportExcel}
              className="shrink-0"
            >
              Exportar Excel
            </PrimaryButton>
          </div>

          <div className="mt-5">
            {filtered.length === 0 ? (
              <EmptyState
                title="No hay movimientos para mostrar"
                description={
                  movements.length === 0
                    ? "Los movimientos realizados sobre los equipos POS aparecerán en este historial."
                    : "Probá cambiando el texto de búsqueda o el tipo de movimiento."
                }
              />
            ) : (
              <>
                <div className="space-y-3 lg:hidden">
                  {filtered.map((movement) => (
                    <article
                      key={movement.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-xs font-medium text-slate-500">
                            {formatDate(movement.created_at)}
                          </p>

                          <StatusBadge
                            label={getTypeLabel(movement.type)}
                            tone={getMovementTone(movement.type)}
                          />
                        </div>

                        <p className="text-base font-bold text-slate-900">
                          {movement.pos_code || "-"}
                        </p>
                      </div>

                      <div className="mt-3 space-y-1 text-xs text-slate-700">
                        <p>
                          <span className="font-semibold text-slate-500">
                            Vendedor:
                          </span>{" "}
                          {movement.vendor_name || "-"}
                        </p>

                        <p>
                          <span className="font-semibold text-slate-500">
                            Comercio:
                          </span>{" "}
                          {movement.merchant_name || "-"}
                        </p>

                        <p>
                          <span className="font-semibold text-slate-500">
                            Usuario:
                          </span>{" "}
                          {movement.user_name || "-"}
                        </p>

                        <p>
                          <span className="font-semibold text-slate-500">
                            Rol:
                          </span>{" "}
                          {movement.user_role || "-"}
                        </p>

                        {movement.user_email ? (
                          <p className="break-all text-slate-500">
                            {movement.user_email}
                          </p>
                        ) : null}
                      </div>

                      <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                        {movement.notes || "-"}
                      </div>
                    </article>
                  ))}
                </div>

                <div className="hidden max-h-[700px] overflow-auto rounded-xl border border-slate-200 lg:block">
                  <table className="min-w-[1180px] w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-100">
                      <tr className="text-left text-slate-700">
                        <th className="px-4 py-3 font-semibold">Fecha</th>
                        <th className="px-4 py-3 font-semibold">Movimiento</th>
                        <th className="px-4 py-3 font-semibold">POS</th>
                        <th className="px-4 py-3 font-semibold">Asignación</th>
                        <th className="px-4 py-3 font-semibold">Usuario</th>
                        <th className="px-4 py-3 font-semibold">Nota</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filtered.map((movement) => (
                        <tr
                          key={movement.id}
                          className="border-t border-slate-200 align-top transition hover:bg-slate-50"
                        >
                          <td className="whitespace-nowrap px-4 py-4 text-slate-700">
                            {formatDate(movement.created_at)}
                          </td>

                          <td className="px-4 py-4">
                            <StatusBadge
                              label={getTypeLabel(movement.type)}
                              tone={getMovementTone(movement.type)}
                            />
                          </td>

                          <td className="px-4 py-4">
                            <p className="font-semibold text-slate-900">
                              {movement.pos_code || "-"}
                            </p>
                          </td>

                          <td className="px-4 py-4">
                            <div className="space-y-1 text-sm text-slate-700">
                              <p>
                                <span className="font-semibold text-slate-500">
                                  Vendedor:
                                </span>{" "}
                                {movement.vendor_name || "-"}
                              </p>

                              <p>
                                <span className="font-semibold text-slate-500">
                                  Comercio:
                                </span>{" "}
                                {movement.merchant_name || "-"}
                              </p>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="space-y-1">
                              <p className="font-medium text-slate-900">
                                {movement.user_name || "-"}
                              </p>

                              <p className="text-xs text-slate-500">
                                Rol: {movement.user_role || "-"}
                              </p>

                              {movement.user_email ? (
                                <p className="text-xs text-slate-500">
                                  {movement.user_email}
                                </p>
                              ) : null}
                            </div>
                          </td>

                          <td className="px-4 py-4 text-slate-700">
                            <p className="max-w-md whitespace-normal">
                              {movement.notes || "-"}
                            </p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </FormCard>
      </div>
    </main>
  );
}