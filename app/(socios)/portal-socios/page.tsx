
"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type Totals = {
  approvedOperations: number;
  excludedOperations: number;
  pendingEconomics: number;
  processedVolume: number;
  merchantFees: number;
  acquirerCosts: number;
  mentaCosts: number;
  pandaCosts: number;
  benefiProfit: number;
  qrOperations: number;
  cardOperations: number;
  otherOperations: number;
};

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

type DashboardResponse = {
  ok: boolean;
  totals: Totals;
  error?: string;
};

type EvolutionResponse = {
  ok: boolean;
  months: MonthlyResult[];
  error?: string;
};

const RED = "#BC2025";

const COST_COLORS = [
  "#BC2025",
  "#64748b",
  "#e5a34a",
];

function currentArgentinaMonth() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find(
    (part) => part.type === "year"
  )?.value;

  const month = parts.find(
    (part) => part.type === "month"
  )?.value;

  return `${year}-${month}`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-AR").format(value);
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}%`;
}

function formatMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);

  return new Intl.DateTimeFormat("es-AR", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

function MetricCard({
  title,
  value,
  detail,
  accent = false,
}: {
  title: string;
  value: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">
        {title}
      </p>

      <p
        className={`mt-2 break-words text-2xl font-bold ${
          accent ? "text-[#BC2025]" : "text-slate-950"
        }`}
      >
        {value}
      </p>

      <p className="mt-2 text-xs text-slate-500">
        {detail}
      </p>
    </div>
  );
}

export default function PortalSociosPage() {
  const [month, setMonth] = useState(
    currentArgentinaMonth
  );

  const [totals, setTotals] = useState<Totals | null>(
    null
  );

  const [history, setHistory] = useState<
    MonthlyResult[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboard() {
      setLoading(true);
      setError(null);
      setTotals(null);
      setHistory([]);

      try {
        const [dashboardResponse, evolutionResponse] =
          await Promise.all([
            fetch(
              `/api/portal-socios/dashboard?month=${month}`,
              {
                signal: controller.signal,
                cache: "no-store",
              }
            ),
            fetch(
              `/api/portal-socios/evolucion?month=${month}`,
              {
                signal: controller.signal,
                cache: "no-store",
              }
            ),
          ]);

        const dashboard =
          (await dashboardResponse.json()) as DashboardResponse;

        const evolution =
          (await evolutionResponse.json()) as EvolutionResponse;

        if (
          !dashboardResponse.ok ||
          !dashboard.ok ||
          !evolutionResponse.ok ||
          !evolution.ok
        ) {
          throw new Error(
            dashboard.error ||
              evolution.error ||
              "No se pudieron cargar los indicadores."
          );
        }

        setTotals(dashboard.totals);
        setHistory(evolution.months);
      } catch (err) {
        if (controller.signal.aborted) return;

        setError(
          err instanceof Error
            ? err.message
            : "Error cargando el Dashboard."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => controller.abort();
  }, [month]);

  const currentResult = history.find(
    (item) => item.month === month
  );

  const previousResult =
    history.length >= 2
      ? history[history.length - 2]
      : null;

  const variationAmount =
    currentResult && previousResult
      ? currentResult.benefiProfit -
        previousResult.benefiProfit
      : null;

  const variationPercent =
    variationAmount !== null &&
    previousResult &&
    previousResult.benefiProfit !== 0
      ? (variationAmount /
          Math.abs(previousResult.benefiProfit)) *
        100
      : null;

  const totalCosts = totals
    ? totals.acquirerCosts +
      totals.mentaCosts +
      totals.pandaCosts
    : 0;

  const operatingMargin =
    totals && totals.processedVolume !== 0
      ? (totals.benefiProfit /
          totals.processedVolume) *
        100
      : 0;

    const commissionMargin =
    totals && totals.merchantFees !== 0
        ? (totals.benefiProfit /
            totals.merchantFees) *
        100
        : 0;

  const costData = totals
    ? [
        {
          name: "Adquirentes",
          value: totals.acquirerCosts,
        },
        {
          name: "MENTA",
          value: totals.mentaCosts,
        },
        {
          name: "PandaPay",
          value: totals.pandaCosts,
        },
      ]
    : [];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">
            Portal de Socios BENEFÍ
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Dashboard ejecutivo de procesamiento y
            rentabilidad operativa.
          </p>
        </div>

        <div>
          <label
            htmlFor="month"
            className="mb-1 block text-xs font-medium text-slate-600"
          >
            Período
          </label>

          <input
            id="month"
            type="month"
            value={month}
            max={currentArgentinaMonth()}
            onChange={(event) =>
              setMonth(event.target.value)
            }
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          />
        </div>
      </div>

      {loading && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Cargando indicadores económicos...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && totals && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Volumen procesado"
              value={formatMoney(totals.processedVolume)}
              detail="Operaciones aprobadas en ARS"
            />

            <MetricCard
              title="Comisiones BENEFÍ"
              value={formatMoney(totals.merchantFees)}
              detail="Ingresos por procesamiento"
            />

            <MetricCard
              title="Costos de procesamiento"
              value={formatMoney(totalCosts)}
              detail="Adquirentes, MENTA y PandaPay"
            />

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-slate-500">
                    Rentabilidad operativa
                </p>

                <p className="mt-2 break-words text-2xl font-bold text-[#BC2025]">
                    {formatMoney(totals.benefiProfit)}
                </p>

                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                    <div>
                    <p className="text-xs text-slate-500">
                        Sobre volumen
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                        {formatPercent(operatingMargin)}
                    </p>
                    </div>

                    <div>
                    <p className="text-xs text-slate-500">
                        Sobre comisiones
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                        {formatPercent(commissionMargin)}
                    </p>
                    </div>
                </div>
                </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
              <h2 className="text-lg font-semibold text-slate-950">
                Evolución mensual de rentabilidad
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Resultado operativo BENEFÍ — últimos 12 meses
                hasta el período seleccionado.
              </p>

              <div className="mt-5 h-72 w-full">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <LineChart
                    data={history}
                    margin={{
                      top: 10,
                      right: 15,
                      left: 5,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#e2e8f0"
                    />

                    <XAxis
                      dataKey="month"
                      tickFormatter={formatMonth}
                      tick={{ fontSize: 11 }}
                    />

                    <YAxis
                      width={70}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value: number) =>
                        new Intl.NumberFormat("es-AR", {
                          notation: "compact",
                          maximumFractionDigits: 1,
                        }).format(value)
                      }
                    />

                    <Tooltip
                      formatter={(value) =>
                        formatMoney(Number(value || 0))
                      }
                      labelFormatter={(label) =>
                        formatMonth(String(label))
                      }
                    />

                    <ReferenceLine
                      y={0}
                      stroke="#94a3b8"
                    />

                    <Line
                      type="monotone"
                      dataKey="benefiProfit"
                      name="Rentabilidad BENEFÍ"
                      stroke={RED}
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">
                Variación mensual
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Comparación con el mes anterior.
              </p>

              <p
                className={`mt-8 text-3xl font-bold ${
                  variationAmount === null
                    ? "text-slate-700"
                    : variationAmount >= 0
                      ? "text-emerald-700"
                      : "text-red-700"
                }`}
              >
                {variationAmount === null
                  ? "Sin comparación"
                  : `${variationAmount >= 0 ? "+" : ""}${formatMoney(
                      variationAmount
                    )}`}
              </p>

              <p className="mt-3 text-lg font-semibold text-slate-700">
                {variationPercent === null
                  ? "Variación porcentual no disponible"
                  : `${variationPercent >= 0 ? "+" : ""}${formatPercent(
                      variationPercent
                    )}`}
              </p>

              <div className="mt-6 border-t border-slate-100 pt-4 text-sm text-slate-500">
                Resultado del mes anterior:
                <p className="mt-1 font-semibold text-slate-900">
                  {previousResult
                    ? formatMoney(
                        previousResult.benefiProfit
                      )
                    : "Sin datos"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">
                Distribución de costos
              </h2>

              <div className="mt-4 h-64">
                {totalCosts > 0 ? (
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <PieChart>
                      <Pie
                        data={costData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                      >
                        {costData.map((item, index) => (
                          <Cell
                            key={item.name}
                            fill={
                              COST_COLORS[
                                index % COST_COLORS.length
                              ]
                            }
                          />
                        ))}
                      </Pie>

                      <Tooltip
                        formatter={(value) =>
                          formatMoney(Number(value || 0))
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    Sin costos registrados.
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {costData.map((item, index) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{
                          backgroundColor:
                            COST_COLORS[index],
                        }}
                      />
                      <span>{item.name}</span>
                    </div>

                    <span className="font-semibold text-slate-900">
                      {formatMoney(item.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">
                Operaciones procesadas
              </h2>

              <p className="mt-5 text-3xl font-bold text-slate-950">
                {formatNumber(totals.approvedOperations)}
              </p>

              <p className="text-xs text-slate-500">
                Operaciones aprobadas
              </p>

              <div className="mt-6 space-y-4">
                {[
                  {
                    label: "Tarjetas",
                    value: totals.cardOperations,
                  },
                  {
                    label: "QR",
                    value: totals.qrOperations,
                  },
                  {
                    label: "Otros",
                    value: totals.otherOperations,
                  },
                ].map((item) => {
                  const percentage =
                    totals.approvedOperations > 0
                      ? (item.value /
                          totals.approvedOperations) *
                        100
                      : 0;

                  return (
                    <div key={item.label}>
                      <div className="mb-2 flex justify-between text-sm">
                        <span>{item.label}</span>
                        <span className="font-semibold">
                          {formatNumber(item.value)}
                        </span>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-[#BC2025]"
                          style={{
                            width: `${percentage}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-500">
                Operaciones excluidas:{" "}
                {formatNumber(totals.excludedOperations)}
              </div>
            </div>
          </div>

          {totals.pendingEconomics > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Atención: existen{" "}
              <strong>
                {formatNumber(totals.pendingEconomics)}
              </strong>{" "}
              operaciones pendientes de cálculo económico.
              La rentabilidad puede estar incompleta.
            </div>
          )}

          <p className="text-xs text-slate-500">
            Los resultados representan rentabilidad
            operativa del procesamiento, antes de gastos
            administrativos, impuestos y otros costos de
            la empresa. Importes expresados en ARS.
          </p>
        </>
      )}
    </div>
  );
}
