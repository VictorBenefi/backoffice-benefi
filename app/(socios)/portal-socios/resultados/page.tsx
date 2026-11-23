
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import * as XLSX from "xlsx";

type MonthlyResult = {
  month: string;
  approvedOperations: number;
  pendingEconomics: number;
  processedVolume: number;
  merchantFees: number;
  acquirerCosts: number;
  mentaCosts: number;
  pandaCosts: number;
  benefiProfit: number;
  variationAmount: number | null;
  variationPercent: number | null;
};

type ApiResponse = {
  ok: boolean;
  currency: string;
  selectedMonth: string;
  fromMonth: string;
  toMonth: string;
  months: MonthlyResult[];
  error?: string;
};

const money = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const number = (value: number) =>
  new Intl.NumberFormat("es-AR").format(value);

const percent = (value: number) =>
  `${value.toFixed(2)}%`;

function monthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);

  const date = new Date(Date.UTC(year, monthNumber - 1, 1));

  return new Intl.DateTimeFormat("es-AR", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function sumMonths(
  months: MonthlyResult[],
  field: keyof MonthlyResult
) {
  return months.reduce((total, item) => {
    const value = item[field];
    return total + (typeof value === "number" ? value : 0);
  }, 0);
}

function SummaryCard({
  title,
  value,
  detail,
  highlight = false,
}: {
  title: string;
  value: string;
  detail?: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p
        className={`mt-2 text-xl font-bold ${
          highlight ? "text-[#BC2025]" : "text-slate-950"
        }`}
      >
        {value}
      </p>
      {detail && (
        <p className="mt-2 text-xs text-slate-500">{detail}</p>
      )}
    </div>
  );
}

export default function PortalSociosResultadosPage() {
  const [month, setMonth] = useState(() =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires",
      year: "numeric",
      month: "2-digit",
    }).format(new Date())
  );

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");
      setData(null);

      try {
        const response = await fetch(
          `/api/portal-socios/evolucion?month=${encodeURIComponent(month)}`,
          {
            signal: controller.signal,
            cache: "no-store",
          }
        );

        const result: ApiResponse = await response.json();

        if (!response.ok || !result.ok) {
          throw new Error(
            result.error || "No se pudieron cargar los resultados."
          );
        }

        if (!controller.signal.aborted) {
          setData(result);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error ? err.message : "Error inesperado."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => controller.abort();
  }, [month]);

  const summary = useMemo(() => {
    const months = data?.months || [];
    const latest = months[months.length - 1] || null;

    const processedVolume = sumMonths(months, "processedVolume");
    const merchantFees = sumMonths(months, "merchantFees");
    const acquirerCosts = sumMonths(months, "acquirerCosts");
    const mentaCosts = sumMonths(months, "mentaCosts");
    const pandaCosts = sumMonths(months, "pandaCosts");
    const benefiProfit = sumMonths(months, "benefiProfit");

    return {
      latest,
      processedVolume,
      merchantFees,
      acquirerCosts,
      mentaCosts,
      pandaCosts,
      benefiProfit,
      approvedOperations: sumMonths(months, "approvedOperations"),
      pendingEconomics: sumMonths(months, "pendingEconomics"),
      marginOnVolume:
        processedVolume !== 0
          ? (benefiProfit / processedVolume) * 100
          : 0,
      marginOnCommissions:
        merchantFees !== 0
          ? (benefiProfit / merchantFees) * 100
          : 0,
    };
  }, [data]);

  function exportExcel() {
    if (!data) return;

    const rows: (string | number)[][] = [
      ["BENEFÍ - Resultados mensuales"],
      ["Desde", data.fromMonth],
      ["Hasta", data.toMonth],
      ["Moneda", data.currency],
      [],
      [
        "Mes",
        "Operaciones",
        "Volumen procesado",
        "Comisiones cobradas",
        "Costos adquirente",
        "Costos MENTA",
        "Costos PandaPay",
        "Costos totales",
        "Resultado BENEFÍ",
        "Margen volumen (%)",
        "Margen comisiones (%)",
        "Variación mensual ($)",
        "Variación mensual (%)",
      ],
    ];

    for (const item of [...data.months].reverse()) {
      const totalCosts =
        item.acquirerCosts + item.mentaCosts + item.pandaCosts;

      rows.push([
        monthLabel(item.month),
        item.approvedOperations,
        item.processedVolume,
        item.merchantFees,
        item.acquirerCosts,
        item.mentaCosts,
        item.pandaCosts,
        totalCosts,
        item.benefiProfit,
        item.processedVolume
          ? (item.benefiProfit / item.processedVolume) * 100
          : 0,
        item.merchantFees
          ? (item.benefiProfit / item.merchantFees) * 100
          : 0,
        item.variationAmount ?? 0,
        item.variationPercent ?? 0,
      ]);
    }

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet(rows);

    const currencyFormat = '"$" #,##0.00';
    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");

    for (let row = 6; row <= range.e.r; row++) {
      for (const col of [2, 3, 4, 5, 6, 7, 8, 11]) {
        const address = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = sheet[address];

        if (cell && typeof cell.v === "number") {
          cell.z = currencyFormat;
        }
      }
    }

    sheet["!cols"] = [
      { wch: 18 },
      { wch: 16 },
      ...Array.from({ length: 11 }, () => ({ wch: 22 })),
    ];

    XLSX.utils.book_append_sheet(
      workbook,
      sheet,
      "Resultados mensuales"
    );

    XLSX.writeFile(
      workbook,
      `BENEFI_Resultados_Mensuales_${data.toMonth}.xlsx`
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">
            Resultados mensuales
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Evolución económica del procesamiento de pagos BENEFÍ.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Mes de cierre
            </label>
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>

          <button
            type="button"
            onClick={exportExcel}
            disabled={!data || loading}
            className="rounded-lg bg-[#BC2025] px-4 py-2 text-sm font-semibold text-white hover:bg-[#a51c21] disabled:opacity-50"
          >
            Exportar Excel
          </button>
        </div>
      </div>

      {loading && (
        <div className="rounded-xl border bg-white p-8 text-center text-slate-500">
          Cargando resultados mensuales...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title={`Resultado ${monthLabel(data.toMonth)}`}
              value={money(summary.latest?.benefiProfit || 0)}
              detail="Rentabilidad operativa del mes seleccionado"
              highlight
            />
            <SummaryCard
              title="Resultado acumulado"
              value={money(summary.benefiProfit)}
              detail="Últimos 12 meses"
              highlight
            />
            <SummaryCard
              title="Volumen acumulado"
              value={money(summary.processedVolume)}
              detail={`${number(summary.approvedOperations)} operaciones aprobadas`}
            />
            <SummaryCard
              title="Margen sobre comisiones"
              value={percent(summary.marginOnCommissions)}
              detail={`Margen sobre volumen: ${percent(summary.marginOnVolume)}`}
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              Evolución de la rentabilidad
            </h2>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.months}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={monthLabel}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    tickFormatter={(value: number) =>
                      new Intl.NumberFormat("es-AR", {
                        notation: "compact",
                      }).format(value)
                    }
                    tick={{ fontSize: 11 }}
                    width={75}
                  />
                  <Tooltip
                    labelFormatter={(label) =>
                      monthLabel(String(label))
                    }
                    formatter={(value) =>
                      money(Number(value ?? 0))
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="benefiProfit"
                    name="Rentabilidad BENEFÍ"
                    stroke="#BC2025"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <h2 className="text-lg font-semibold text-slate-900">
                Estado de resultados operativos
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Comparativo de los últimos 12 meses, sin gastos
                administrativos ni impuestos corporativos.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1250px] text-right text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Mes</th>
                    <th className="px-4 py-3">Operaciones</th>
                    <th className="px-4 py-3">Volumen</th>
                    <th className="px-4 py-3">Comisiones</th>
                    <th className="px-4 py-3">Adquirente</th>
                    <th className="px-4 py-3">MENTA</th>
                    <th className="px-4 py-3">PandaPay</th>
                    <th className="px-4 py-3">Costos totales</th>
                    <th className="px-4 py-3">Resultado BENEFÍ</th>
                    <th className="px-4 py-3">Margen comisiones</th>
                    <th className="px-4 py-3">Variación mensual</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {[...data.months].reverse().map((item) => {
                    const costs =
                      item.acquirerCosts +
                      item.mentaCosts +
                      item.pandaCosts;

                    const margin =
                      item.merchantFees !== 0
                        ? (item.benefiProfit / item.merchantFees) * 100
                        : 0;

                    return (
                      <tr key={item.month} className="hover:bg-slate-50">
                        <td className="whitespace-nowrap px-4 py-3 text-left font-medium text-slate-900">
                          {monthLabel(item.month)}
                        </td>
                        <td className="px-4 py-3">
                          {number(item.approvedOperations)}
                        </td>
                        <td className="px-4 py-3">
                          {money(item.processedVolume)}
                        </td>
                        <td className="px-4 py-3">
                          {money(item.merchantFees)}
                        </td>
                        <td className="px-4 py-3">
                          {money(item.acquirerCosts)}
                        </td>
                        <td className="px-4 py-3">
                          {money(item.mentaCosts)}
                        </td>
                        <td className="px-4 py-3">
                          {money(item.pandaCosts)}
                        </td>
                        <td className="px-4 py-3">
                          {money(costs)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#BC2025]">
                          {money(item.benefiProfit)}
                        </td>
                        <td className="px-4 py-3">
                          {percent(margin)}
                        </td>
                        <td className="px-4 py-3">
                          {item.variationPercent === null
                            ? "—"
                            : percent(item.variationPercent)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {summary.pendingEconomics > 0 && (
            <p className="text-sm text-amber-700">
              Hay {number(summary.pendingEconomics)} operaciones
              pendientes de cálculo económico en el período.
            </p>
          )}

          <p className="text-xs text-slate-500">
            Los resultados corresponden exclusivamente al procesamiento
            de pagos y no representan la utilidad neta contable de BENEFÍ.
            Los meses sin registros pueden reflejar ausencia de datos
            históricos cargados.
          </p>
        </>
      )}
    </div>
  );
}
