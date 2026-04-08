"use client";

import { useState } from "react";

const MONTHS = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
];

type Props = {
  defaultYear?: number;
  defaultMonth?: number;
};

export default function LiquidateMonthButton({
  defaultYear = 2026,
  defaultMonth = 4,
}: Props) {
  const [year, setYear] = useState<number>(defaultYear);
  const [month, setMonth] = useState<number>(defaultMonth);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleLiquidate() {
    try {
      setLoading(true);
      setMessage("");
      setError("");

      const res = await fetch("/api/commissions/liquidate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ year, month }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "No se pudo liquidar el período");
      }

      setMessage(
        `Liquidación generada correctamente. Vendedores procesados: ${data.totalVendors ?? 0}`
      );

      // Recarga la página para que, si ya tenés listado/historial,
      // se actualice automáticamente
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err: any) {
      setError(err?.message || "Ocurrió un error al liquidar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Liquidar comisiones mensuales</h2>
        <p className="text-sm text-gray-500">
          Genera o actualiza la liquidación del período seleccionado.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Año</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-full rounded-xl border px-3 py-2 outline-none"
            min={2024}
            max={2035}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Mes</label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="w-full rounded-xl border px-3 py-2 outline-none"
          >
            {MONTHS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={handleLiquidate}
            disabled={loading}
            className="w-full rounded-xl bg-black px-4 py-2 text-white disabled:opacity-60"
          >
            {loading ? "Liquidando..." : "Liquidar comisiones"}
          </button>
        </div>
      </div>

      {message && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {message}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}