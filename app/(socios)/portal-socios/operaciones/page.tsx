
"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

type Totals = {
  approvedOperations: number;
  pendingEconomics: number;
  processedVolume: number;
  merchantFees: number;
  acquirerCosts: number;
  mentaCosts: number;
  pandaCosts: number;
  benefiProfit: number;
  marginOnVolume: number;
  marginOnCommissions: number;
};

type PaymentGroup = Totals & {
  paymentMethod: string;
};

type MerchantGroup = Totals & {
  merchantId: string | null;
  merchantName: string;
  paymentMethods: PaymentGroup[];
};

type ApiResponse = {
  ok: boolean;
  month: string;
  currency: string;
  totals: Totals & { excludedOperations: number };
  merchants: MerchantGroup[];
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

function paymentLabel(method: string) {
  const labels: Record<string, string> = {
    QR: "QR",
    CREDIT: "Crédito",
    DEBIT: "Débito",
    PREPAID: "Prepaga",
    OTHER: "Otros",
  };

  return labels[method] || method;
}

function CostSummary({ data }: { data: Totals }) {
  return (
    <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
      {[
        ["Adquirente", data.acquirerCosts],
        ["MENTA", data.mentaCosts],
        ["PandaPay", data.pandaCosts],
        ["Rentabilidad", data.benefiProfit],
      ].map(([label, value]) => (
        <div key={String(label)} className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-500">{label}</p>
          <p className="mt-1 font-semibold text-slate-900">
            {money(Number(value))}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function PortalSociosOperacionesPage() {
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
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("volume");
  const [expanded, setExpanded] = useState<string[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");
      setData(null);

      try {
        const response = await fetch(
          `/api/portal-socios/operaciones?month=${encodeURIComponent(month)}`,
          { signal: controller.signal, cache: "no-store" }
        );

        const result: ApiResponse = await response.json();

        if (!response.ok || !result.ok) {
          throw new Error(result.error || "No se pudieron cargar los datos.");
        }

        if (!controller.signal.aborted) {
          setData(result);
          setExpanded([]);
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

  const merchants = useMemo(() => {
    const filtered = (data?.merchants || []).filter((merchant) =>
      merchant.merchantName.toLowerCase().includes(search.toLowerCase())
    );

    return [...filtered].sort((a, b) => {
      if (sort === "profit") return b.benefiProfit - a.benefiProfit;
      if (sort === "name") {
        return a.merchantName.localeCompare(b.merchantName, "es");
      }
      return b.processedVolume - a.processedVolume;
    });
  }, [data, search, sort]);


function exportExcel() {
  if (!data) return;

  const totals = data.totals;

  const summary = [
    ["BENEFÍ - Procesamiento por comercio"],
    ["Período", data.month],
    ["Moneda", data.currency],
    [],
    ["Indicador", "Valor"],
    ["Operaciones aprobadas", totals.approvedOperations],
    ["Volumen procesado", totals.processedVolume],
    ["Comisiones cobradas", totals.merchantFees],
    ["Costos adquirente", totals.acquirerCosts],
    ["Costos MENTA", totals.mentaCosts],
    ["Costos PandaPay", totals.pandaCosts],
    ["Rentabilidad BENEFÍ", totals.benefiProfit],
    ["Margen sobre volumen (%)", totals.marginOnVolume],
    ["Margen sobre comisiones (%)", totals.marginOnCommissions],
    ["Operaciones pendientes de cálculo", totals.pendingEconomics],
    ["Operaciones excluidas", totals.excludedOperations],
  ];

  const detail: (string | number)[][] = [
    [
      "Comercio",
      "Medio de pago",
      "Operaciones",
      "Volumen procesado",
      "Comisiones",
      "Adquirente",
      "MENTA",
      "PandaPay",
      "Costos totales",
      "Rentabilidad BENEFÍ",
      "Margen volumen (%)",
      "Margen comisiones (%)",
    ],
  ];

  for (const merchant of data.merchants) {
    const totalCosts =
      merchant.acquirerCosts +
      merchant.mentaCosts +
      merchant.pandaCosts;

    detail.push([
      merchant.merchantName,
      "TOTAL COMERCIO",
      merchant.approvedOperations,
      merchant.processedVolume,
      merchant.merchantFees,
      merchant.acquirerCosts,
      merchant.mentaCosts,
      merchant.pandaCosts,
      totalCosts,
      merchant.benefiProfit,
      merchant.marginOnVolume,
      merchant.marginOnCommissions,
    ]);

    for (const method of merchant.paymentMethods) {
      detail.push([
        merchant.merchantName,
        paymentLabel(method.paymentMethod),
        method.approvedOperations,
        method.processedVolume,
        method.merchantFees,
        method.acquirerCosts,
        method.mentaCosts,
        method.pandaCosts,
        method.acquirerCosts +
          method.mentaCosts +
          method.pandaCosts,
        method.benefiProfit,
        method.marginOnVolume,
        method.marginOnCommissions,
      ]);
    }
  }

  const workbook = XLSX.utils.book_new();

  const summarySheet = XLSX.utils.aoa_to_sheet(summary);
  const detailSheet = XLSX.utils.aoa_to_sheet(detail);


  // Formato monetario ARS para Excel
  const currencyFormat = '"$" #,##0.00';

  // Resumen general: importes de B7 a B12
  for (let row = 7; row <= 12; row++) {
    const cell = summarySheet[`B${row}`];

    if (cell && typeof cell.v === "number") {
      cell.z = currencyFormat;
    }
  }

  // Consolidado: columnas D a J
  // D: volumen, E: comisiones, F-H: costos,
  // I: costos totales, J: rentabilidad
  const detailRange = XLSX.utils.decode_range(
    detailSheet["!ref"] || "A1"
  );

  for (let row = 1; row <= detailRange.e.r; row++) {
    for (let col = 3; col <= 9; col++) {
      const address = XLSX.utils.encode_cell({
        r: row,
        c: col,
      });

      const cell = detailSheet[address];

      if (cell && typeof cell.v === "number") {
        cell.z = currencyFormat;
      }
    }
  }


  summarySheet["!cols"] = [
    { wch: 37 },
    { wch: 23 },
  ];

  detailSheet["!cols"] = [
    { wch: 32 },
    { wch: 20 },
    ...Array.from({ length: 10 }, () => ({ wch: 19 })),
  ];

  XLSX.utils.book_append_sheet(
    workbook,
    summarySheet,
    "Resumen general"
  );

  XLSX.utils.book_append_sheet(
    workbook,
    detailSheet,
    "Consolidado comercios"
  );

  XLSX.writeFile(
    workbook,
    `BENEFI_Procesamiento_Comercios_${data.month}.xlsx`
  );
}


  function toggle(id: string) {
    setExpanded((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">
            Procesamiento por comercio
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Consolidado mensual de operaciones y rentabilidad BENEFÍ.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Período
          </label>
          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </div>
      </div>

      {loading && (
        <div className="rounded-xl border bg-white p-8 text-center text-slate-500">
          Cargando consolidado...
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
            {[
              ["Operaciones aprobadas", number(data.totals.approvedOperations)],
              ["Volumen procesado", money(data.totals.processedVolume)],
              ["Comisiones cobradas", money(data.totals.merchantFees)],
              ["Rentabilidad BENEFÍ", money(data.totals.benefiProfit)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-2 text-xl font-bold text-slate-950">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-semibold text-slate-900">
              Costos y márgenes generales
            </h2>
            <CostSummary data={data.totals} />
            <div className="mt-4 flex flex-wrap gap-6 text-sm text-slate-600">
              <span>
                Margen sobre volumen:{" "}
                <strong>{percent(data.totals.marginOnVolume)}</strong>
              </span>
              <span>
                Margen sobre comisiones:{" "}
                <strong>{percent(data.totals.marginOnCommissions)}</strong>
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b p-4">
              <div>
                <h2 className="font-semibold text-slate-900">
                  Comercios
                </h2>
                <p className="text-xs text-slate-500">
                  {number(merchants.length)} comercios encontrados
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={exportExcel}
                    className="rounded-lg bg-[#BC2025] px-4 py-2 text-sm font-semibold text-white hover:bg-[#a51c21]"
                    >
                    Exportar Excel
                </button>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar comercio..."
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="volume">Mayor volumen</option>
                  <option value="profit">Mayor rentabilidad</option>
                  <option value="name">Nombre</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Comercio / medio</th>
                    <th className="px-4 py-3 text-right">Operaciones</th>
                    <th className="px-4 py-3 text-right">Procesado</th>
                    <th className="px-4 py-3 text-right">Comisiones</th>
                    <th className="px-4 py-3 text-right">Costos</th>
                    <th className="px-4 py-3 text-right">Rentabilidad</th>
                    <th className="px-4 py-3 text-right">Margen volumen</th>
                    <th className="px-4 py-3 text-right">Margen comisiones</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {merchants.map((merchant) => {
                    const key = merchant.merchantId || "__unlinked__";
                    const isExpanded = expanded.includes(key);
                    const totalCosts =
                      merchant.acquirerCosts +
                      merchant.mentaCosts +
                      merchant.pandaCosts;

                    return (
                      <FragmentRow
                        key={key}
                        merchant={merchant}
                        isExpanded={isExpanded}
                        totalCosts={totalCosts}
                        onToggle={() => toggle(key)}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>

            {merchants.length === 0 && (
              <p className="p-8 text-center text-sm text-slate-500">
                No se encontraron comercios.
              </p>
            )}
          </div>

          {data.totals.pendingEconomics > 0 && (
            <p className="text-sm text-amber-700">
              Hay {number(data.totals.pendingEconomics)} operaciones
              pendientes de cálculo económico.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function FragmentRow({
  merchant,
  isExpanded,
  totalCosts,
  onToggle,
}: {
  merchant: MerchantGroup;
  isExpanded: boolean;
  totalCosts: number;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="cursor-pointer bg-white hover:bg-slate-50"
        onClick={onToggle}
      >
        <td className="px-4 py-3 font-semibold text-slate-900">
          <button type="button" onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }} className="text-left">
            <span className="mr-2 text-red-700">
              {isExpanded ? "▼" : "▶"}
            </span>
            {merchant.merchantName}
          </button>
        </td>
        <td className="px-4 py-3 text-right">
          {number(merchant.approvedOperations)}
        </td>
        <td className="px-4 py-3 text-right">{money(merchant.processedVolume)}</td>
        <td className="px-4 py-3 text-right">{money(merchant.merchantFees)}</td>
        <td className="px-4 py-3 text-right">{money(totalCosts)}</td>
        <td className="px-4 py-3 text-right font-semibold text-emerald-700">
          {money(merchant.benefiProfit)}
        </td>
        <td className="px-4 py-3 text-right">{percent(merchant.marginOnVolume)}</td>
        <td className="px-4 py-3 text-right">{percent(merchant.marginOnCommissions)}</td>
      </tr>

      {isExpanded &&
        merchant.paymentMethods.map((method) => (
          <tr key={method.paymentMethod} className="bg-slate-50/70 text-slate-600">
            <td className="px-4 py-3 pl-10">
              ↳ {paymentLabel(method.paymentMethod)}
            </td>
            <td className="px-4 py-3 text-right">
              {number(method.approvedOperations)}
            </td>
            <td className="px-4 py-3 text-right">{money(method.processedVolume)}</td>
            <td className="px-4 py-3 text-right">{money(method.merchantFees)}</td>
            <td className="px-4 py-3 text-right">
              {money(method.acquirerCosts + method.mentaCosts + method.pandaCosts)}
            </td>
            <td className="px-4 py-3 text-right font-medium text-emerald-700">
              {money(method.benefiProfit)}
            </td>
            <td className="px-4 py-3 text-right">{percent(method.marginOnVolume)}</td>
            <td className="px-4 py-3 text-right">{percent(method.marginOnCommissions)}</td>
          </tr>
        ))}
    </>
  );
}
