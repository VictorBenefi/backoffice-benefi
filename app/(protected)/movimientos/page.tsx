"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";

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

  const loadMovements = async () => {
    const { data, error } = await supabase
      .from("pos_movements")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error cargando movimientos:", error.message);
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
    if (filtered.length === 0) {
      alert("No hay movimientos para exportar.");
      return;
    }

    const exportData = filtered.map((m) => ({
      Fecha: formatDate(m.created_at),
      Tipo: getTypeLabel(m.type),
      "Código POS": m.pos_code || "-",
      Vendedor: m.vendor_name || "-",
      Comercio: m.merchant_name || "-",
      Usuario: m.user_name || "-",
      "Email usuario": m.user_email || "-",
      Rol: m.user_role || "-",
      Nota: m.notes || "-",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Movimientos");

    XLSX.writeFile(workbook, getExportFileName());
  };

  return (
    <main className="p-6 bg-gray-50 min-h-screen">
      <div className="flex flex-col gap-3 mb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Movimientos de POS</h1>
          <p className="text-sm text-slate-500">
            Historial operativo de movimientos realizados sobre terminales POS
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportExcel}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700"
        >
          Exportar Excel
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar por POS, vendedor, comercio, usuario, rol o nota..."
          className="border rounded-md px-3 py-2 text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="border rounded-md px-3 py-2 text-sm"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">Todos los movimientos</option>
          <option value="ingreso_stock">Ingreso a stock</option>
          <option value="retorno_stock">Retorno a stock</option>
          <option value="asignado_comercio">Asignado a comercio</option>
          <option value="asignado_vendedor">Asignado a vendedor</option>
          <option value="mantenimiento">Mantenimiento</option>
          <option value="baja">Baja</option>
          <option value="instalacion_completada">Instalación completada</option>
        </select>

        <button
          type="button"
          onClick={() => {
            setSearch("");
            setTypeFilter("");
          }}
          className="border rounded-md px-3 py-2 text-sm hover:bg-slate-50"
        >
          Limpiar filtros
        </button>
      </div>

      <div className="bg-white rounded-xl border h-[700px] flex flex-col">
        <div className="px-4 py-2 border-b text-sm text-slate-500">
          {filtered.length} movimientos de {movements.length} totales
        </div>

        <div className="overflow-auto flex-1">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-slate-100 z-10">
              <tr className="text-left">
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Código POS</th>
                <th className="px-4 py-3">Vendedor</th>
                <th className="px-4 py-3">Comercio</th>
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Nota</th>
              </tr>
            </thead>

            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    No hay movimientos para mostrar.
                  </td>
                </tr>
              ) : (
                filtered.map((m) => (
                  <tr key={m.id} className="border-t align-top">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDate(m.created_at)}
                    </td>

                    <td className="px-4 py-3 font-medium">
                      {getTypeLabel(m.type)}
                    </td>

                    <td className="px-4 py-3">{m.pos_code || "-"}</td>

                    <td className="px-4 py-3">{m.vendor_name || "-"}</td>

                    <td className="px-4 py-3">{m.merchant_name || "-"}</td>

                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span>{m.user_name || "-"}</span>
                        {m.user_email && (
                          <span className="text-xs text-slate-500">
                            {m.user_email}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3">{m.user_role || "-"}</td>

                    <td className="px-4 py-3">{m.notes || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}