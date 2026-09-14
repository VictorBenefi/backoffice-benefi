"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type Liquidation = {
  merchant_id_benefi: string | null;
  merchant_branch_id_benefi: string | null;
  merchant_payment_date: string;
  operation_count: number | string;
  pos_count: number | string;
  pos_codes: string | null;

  gross_amount: number | string | null;

  merchant_commission:
    | number
    | string
    | null;

  merchant_commission_vat:
    | number
    | string
    | null;

  financial_cost:
    | number
    | string
    | null;

  financial_cost_vat:
    | number
    | string
    | null;

  calculated_net_amount:
    | number
    | string
    | null;

  merchant_net_amount:
    | number
    | string
    | null;

  reconciliation_difference:
    | number
    | string
    | null;
};

type Merchant = {
  id: string;
  name: string;
};

type MerchantBranch = {
  id: string;
  merchant_id: string;
  branch_number: number;
  branch_name: string | null;
};

function today() {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function firstDayOfMonth() {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    "01",
  ].join("-");
}

function lastDayOfMonth() {
  const now = new Date();

  const lastDay = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0
  );

  return [
    lastDay.getFullYear(),
    String(lastDay.getMonth() + 1).padStart(
      2,
      "0"
    ),
    String(lastDay.getDate()).padStart(2, "0"),
  ].join("-");
}

function toNumber(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: unknown) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(toNumber(value));
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function isReconciled(value: unknown) {
  return Math.abs(toNumber(value)) <= 1;
}

export default function LiquidacionesPage() {
  const [liquidations, setLiquidations] = useState<
    Liquidation[]
  >([]);

  const [merchants, setMerchants] = useState<
    Merchant[]
  >([]);

  const [branches, setBranches] = useState<
    MerchantBranch[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [dateFrom, setDateFrom] = useState(
    firstDayOfMonth()
  );

  const [dateTo, setDateTo] = useState(
    lastDayOfMonth()
  );

  const [merchantFilter, setMerchantFilter] =
    useState("");

  const [branchFilter, setBranchFilter] =
  useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        "/api/liquidaciones",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error ||
            "No se pudieron cargar las liquidaciones."
        );
      }

      setLiquidations(
        (data.liquidations || []) as Liquidation[]
      );

      setMerchants(
        (data.merchants || []) as Merchant[]
      );

      setBranches(
        (data.branches || []) as MerchantBranch[]
      );

    } catch (error) {
      console.error(
        "Error cargando liquidaciones:",
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar las liquidaciones."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const merchantMap = useMemo(() => {
    return new Map(
      merchants.map((merchant) => [
        merchant.id,
        merchant,
      ])
    );
  }, [merchants]);

  const branchMap = useMemo(() => {
    return new Map(
      branches.map((branch) => [
        branch.id,
        branch,
      ])
    );
  }, [branches]);

  const filteredLiquidations = useMemo(() => {
    return liquidations.filter((item) => {
      if (
        dateFrom &&
        item.merchant_payment_date < dateFrom
      ) {
        return false;
      }

      if (
        dateTo &&
        item.merchant_payment_date > dateTo
      ) {
        return false;
      }

      if (
        merchantFilter &&
        item.merchant_id_benefi !== merchantFilter
      ) {
        return false;
      }

      if (
        branchFilter &&
        item.merchant_branch_id_benefi !== branchFilter
      ) {
        return false;
      }

      return true;
    });
  }, [
    liquidations,
    dateFrom,
    dateTo,
    merchantFilter,
    branchFilter,
    
  ]);

  const metrics = useMemo(() => {
    const currentDate = today();

    let netToCredit = 0;
    let settledToday = 0;
    let operationCount = 0;

    const futureLiquidations =
      filteredLiquidations
        .filter(
          (item) =>
            item.merchant_payment_date >
            currentDate
        )
        .sort((a, b) =>
          a.merchant_payment_date.localeCompare(
            b.merchant_payment_date
          )
        );

    for (const item of filteredLiquidations) {
      const net = toNumber(
        item.merchant_net_amount
      );

      operationCount += toNumber(
        item.operation_count
      );

      if (
        item.merchant_payment_date >
        currentDate
      ) {
        netToCredit += net;
      }

      if (
        item.merchant_payment_date ===
        currentDate
      ) {
        settledToday += net;
      }
    }

    const nextDate =
      futureLiquidations.length > 0
        ? futureLiquidations[0]
            .merchant_payment_date
        : null;

    const nextAmount = nextDate
      ? futureLiquidations
          .filter(
            (item) =>
              item.merchant_payment_date ===
              nextDate
          )
          .reduce(
            (total, item) =>
              total +
              toNumber(
                item.merchant_net_amount
              ),
            0
          )
      : 0;

    return {
      netToCredit,
      settledToday,
      operationCount,
      nextDate,
      nextAmount,
    };
  }, [filteredLiquidations]);

  const clearFilters = () => {
    setDateFrom(firstDayOfMonth());
    setDateTo(lastDayOfMonth());
    setMerchantFilter("");
    setBranchFilter("");
  };

  return (
    <main className="min-h-screen min-w-0 overflow-x-hidden bg-slate-50 p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-950 md:text-3xl">
          Liquidaciones
        </h1>

        <p className="mt-1 text-sm leading-6 text-slate-500">
          Consulta y seguimiento de las
          acreditaciones correspondientes a las
          operaciones procesadas mediante los POS
          BENEFÍ.
        </p>
      </div>

      {message && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      )}

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Neto a acreditar"
          value={formatMoney(
            metrics.netToCredit
          )}
          subtitle="Próximas liquidaciones"
        />

        <MetricCard
          title="Liquidado hoy"
          value={formatMoney(
            metrics.settledToday
          )}
          subtitle="Según fecha de pago"
        />

        <MetricCard
          title="Próxima acreditación"
          value={
            metrics.nextDate
              ? formatDate(metrics.nextDate)
              : "-"
          }
          subtitle={
            metrics.nextDate
              ? formatMoney(
                  metrics.nextAmount
                )
              : "Sin acreditaciones próximas"
          }
        />

        <MetricCard
          title="Operaciones"
          value={String(
            metrics.operationCount
          )}
          subtitle="Incluidas en el período"
        />
      </section>

      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900">
            Filtros fecha de pago
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            El resumen y el listado se actualizan
            según los filtros seleccionados.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">
              Desde
            </label>

            <input
              type="date"
              value={dateFrom}
              onChange={(event) =>
                setDateFrom(event.target.value)
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">
              Hasta
            </label>

            <input
              type="date"
              value={dateTo}
              onChange={(event) =>
                setDateTo(event.target.value)
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">
              Comercio
            </label>

            <select
              value={merchantFilter}
              onChange={(event) => {
                setMerchantFilter(event.target.value);
                setBranchFilter("");
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500"
            >
              <option value="">
                Todos los comercios
              </option>

              {merchants.map((merchant) => (
                <option
                  key={merchant.id}
                  value={merchant.id}
                >
                  {merchant.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">
              Sucursal
            </label>

            <select
              value={branchFilter}
              onChange={(event) =>
                setBranchFilter(event.target.value)
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500"
            >
              <option value="">
                Todas las sucursales
              </option>

              {branches
                .filter(
                  (branch) =>
                    !merchantFilter ||
                    branch.merchant_id === merchantFilter
                )
                .map((branch) => (
                  <option
                    key={branch.id}
                    value={branch.id}
                  >
                    {branch.branch_name ||
                      `Sucursal ${branch.branch_number}`}
                  </option>
                ))}
            </select>
          </div>
          
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Limpiar filtros
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Detalle de liquidaciones
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {filteredLiquidations.length}{" "}
            liquidaciones encontradas
          </p>
        </div>

        {loading ? (
          <div className="px-4 py-12 text-center text-sm text-slate-500">
            Cargando liquidaciones...
          </div>
        ) : filteredLiquidations.length ===
          0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-500">
            No hay liquidaciones para los filtros
            seleccionados.
          </div>
        ) : (
          <>
            <div className="hidden max-h-[620px] overflow-auto lg:block">
              <table className="w-full min-w-[1050px] border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-sm">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">
                      Fecha pago
                    </th>

                    <th className="px-4 py-3 text-left font-semibold">
                      Comercio
                    </th>               
                    
                    <th className="px-4 py-3 text-right font-semibold">
                      Operaciones
                    </th>

                    <th className="px-4 py-3 text-right font-semibold">
                      POS
                    </th>

                    <th className="px-4 py-3 text-right font-semibold">
                      Bruto
                    </th>

                    <th className="px-4 py-3 text-right font-semibold">
                      Neto
                    </th>

                    <th className="px-4 py-3 text-center font-semibold">
                      Conciliación
                    </th>

                    <th className="px-4 py-3 text-right font-semibold">
                     Acción
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredLiquidations.map(
                    (item, index) => {
                      const merchant =
                        item.merchant_id_benefi
                          ? merchantMap.get(
                              item.merchant_id_benefi
                            )
                          : null;
                      const branch =
                        item.merchant_branch_id_benefi
                          ? branchMap.get(
                              item.merchant_branch_id_benefi
                            )
                          : null;

                      const key = [
                        item.merchant_id_benefi,
                        item.merchant_payment_date,
                        index,
                        ].join("-");

                      return (
                        <tr
                          key={key}
                          className="border-t border-slate-100 text-sm text-slate-700 hover:bg-slate-50"
                        >
                          <td className="whitespace-nowrap px-4 py-3">
                            {formatDate(
                              item.merchant_payment_date
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900">
                              {merchant?.name || "Sin vincular"}
                            </div>

                            <div className="mt-1 text-xs text-slate-500">
                              {branch?.branch_name || "Casa central"}
                            </div>
                          </td>

                          
                        <td className="px-4 py-3 text-right">
                        {toNumber(
                            item.operation_count
                        )}
                        </td>

                        <td className="px-4 py-3 text-right">
                        <div className="font-medium text-slate-900">
                            {item.pos_codes || "-"}
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                            {toNumber(item.pos_count)}{" "}
                            {toNumber(item.pos_count) === 1
                            ? "equipo"
                            : "equipos"}
                        </div>
                        </td>

                          <td className="px-4 py-3 text-right font-medium">
                            {formatMoney(
                              item.gross_amount
                            )}
                          </td>

                          <td className="px-4 py-3 text-right font-bold text-slate-950">
                            {formatMoney(
                              item.merchant_net_amount
                            )}
                          </td>

                        <td className="px-4 py-3 text-center">
                          {isReconciled(
                            item.reconciliation_difference
                          ) ? (
                            <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                              Conciliada
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                              Diferencia
                            </span>
                          )}
                        </td>

                          <td className="px-4 py-3 text-right">
                            <button
                                type="button"
                                onClick={() => {
                                  const params = new URLSearchParams({
                                    merchant_id:
                                      item.merchant_id_benefi || "",
                                    payment_date:
                                      item.merchant_payment_date,
                                  });

                                  if (item.merchant_branch_id_benefi) {
                                    params.set(
                                      "branch_id",
                                      item.merchant_branch_id_benefi
                                    );
                                  }

                                  window.location.href =
                                    `/liquidaciones/detalle?${params.toString()}`;
                                }}
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                                Ver detalle
                            </button>
                            </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 lg:hidden">
              {filteredLiquidations.map(
                (item, index) => {
                  const merchant =
                    item.merchant_id_benefi
                      ? merchantMap.get(
                          item.merchant_id_benefi
                        )
                      : null;
                  const branch =
                    item.merchant_branch_id_benefi
                      ? branchMap.get(
                          item.merchant_branch_id_benefi
                        )
                      : null;

                  const key = [
                    item.merchant_id_benefi,
                    item.merchant_payment_date,
                    index,
                    ].join("-");

                  return (
                    <div
                      key={key}
                      className="p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">
                            {merchant?.name ||
                              "Sin vincular"}
                          </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {branch?.branch_name || "Casa central"}
                        </p>

                          <p className="mt-1 text-sm text-slate-500">
                            Pago{" "}
                            {formatDate(
                              item.merchant_payment_date
                            )}
                          </p>
                        </div>
                        
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        
                        <div>
                          <p className="text-xs text-slate-500">
                            Operaciones
                          </p>

                          <p className="mt-1 font-medium text-slate-800">
                            {toNumber(
                              item.operation_count
                            )}
                          </p>
                        </div>

                        <div>
                            <p className="text-xs text-slate-500">
                            POS
                            </p>

                            <p className="mt-1 font-medium text-slate-800">
                                {item.pos_codes || "-"}
                            </p>

                            <p className="mt-1 text-sm text-slate-500">
                                {toNumber(item.pos_count)}{" "}
                                {toNumber(item.pos_count) === 1
                                ? "equipo"
                                : "equipos"}
                            </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-500">
                            Bruto
                          </p>

                          <p className="mt-1 font-medium text-slate-800">
                            {formatMoney(
                              item.gross_amount
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 border-t border-slate-100 pt-3">
                        <p className="text-xs text-slate-500">
                          Neto a acreditar
                        </p>

                        <p className="mt-1 text-lg font-bold text-slate-950">
                          {formatMoney(
                            item.merchant_net_amount
                          )}
                        </p>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {title}
      </p>

      <p className="mt-2 text-2xl font-bold text-slate-950">
        {value}
      </p>

      <p className="mt-1 text-sm text-slate-500">
        {subtitle}
      </p>
    </div>
  );
}