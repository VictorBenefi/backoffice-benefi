"use client";

import {
  useEffect,
  useState,
} from "react";

type PartnerSummary = {
  partner_id: string;
  partner_name: string;
  operation_count: number;
  gross_amount: number;
  partner_commission: number;
  liquidation_id: string | null;
  status: "OPEN" | "CLOSED" | "PAID";
  closed_at: string | null;
  paid_at: string | null;
  by_payment_method: Record<
    string,
    {
      operation_count: number;
      gross_amount: number;
      partner_commission: number;
    }
  >;
};

type PartnerOperation = {
  id: string;
  partner_id: string | null;
  partner_name: string;
  merchant_id: string | null;
  merchant_name: string;
  operation_number: string | null;
  operation_type: string | null;
  payment_method: string | null;
  transaction_datetime: string | null;
  gross_amount: number;
  commission_rate: number;
  partner_commission: number;
};

function getCurrentMonth() {
  const now = new Date();

  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        "America/Argentina/Buenos_Aires",
      year: "numeric",
      month: "2-digit",
    }
  ).format(now);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat(
    "es-AR",
    {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 2,
    }
  ).format(value);
}

function getStatusLabel(
  status: PartnerSummary["status"]
) {
  if (status === "PAID") {
    return "Pagada";
  }

  if (status === "CLOSED") {
    return "Cerrada";
  }

  return "En curso";
}

export default function MisComisionesPage() {
  const [month, setMonth] =
    useState(getCurrentMonth());

  const [summaries, setSummaries] =
    useState<PartnerSummary[]>([]);

  const [operations, setOperations] =
    useState<PartnerOperation[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [
    merchantFilter,
    setMerchantFilter,
  ] = useState("");

  const [
    paymentMethodFilter,
    setPaymentMethodFilter,
  ] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `/api/portal-comercio/mis-comisiones?month=${month}`,
          {
            cache: "no-store",
          }
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "No se pudieron cargar las comisiones"
          );
        }

        setSummaries(
          data.summaries || []
        );

        setOperations(
          data.operations || []
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Error inesperado"
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [month]);

  const summary =
    summaries[0] || null;

  const filteredOperations =
    operations.filter(
      (operation) =>
        (!merchantFilter ||
          operation.merchant_id ===
            merchantFilter) &&
        (!paymentMethodFilter ||
          operation.payment_method ===
            paymentMethodFilter)
    );

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">
          Mis comisiones
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Consultá las comisiones
          generadas por las operaciones
          de tu red de comercios.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="max-w-xs">
          <label className="mb-1 block text-sm font-medium text-slate-600">
            Período
          </label>

          <input
            type="month"
            value={month}
            onChange={(event) => {
              setMonth(
                event.target.value
              );

              setMerchantFilter("");
              setPaymentMethodFilter("");
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          Cargando comisiones...
        </div>
      ) : !summary ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          No hay información de
          comisiones para este período.
        </div>
      ) : (
        <>
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  {summary.partner_name}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Resumen del período
                  seleccionado.
                </p>
              </div>

              <span
                className={
                  summary.status ===
                  "PAID"
                    ? "inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700"
                    : summary.status ===
                        "CLOSED"
                      ? "inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700"
                      : "inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700"
                }
              >
                {getStatusLabel(
                  summary.status
                )}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">
                  Operaciones
                </p>

                <p className="mt-2 text-2xl font-bold text-slate-950">
                  {
                    summary.operation_count
                  }
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">
                  Volumen procesado
                </p>

                <p className="mt-2 text-2xl font-bold text-slate-950">
                  {formatMoney(
                    summary.gross_amount
                  )}
                </p>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                <p className="text-sm text-emerald-700">
                  Comisión generada
                </p>

                <p className="mt-2 text-2xl font-bold text-emerald-700">
                  {formatMoney(
                    summary.partner_commission
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["QR", "QR"],
              ["DEBIT", "Débito"],
              ["CREDIT", "Crédito"],
              ["PREPAID", "Prepaga"],
            ].map(
              ([method, label]) => {
                const detail =
                  summary
                    .by_payment_method[
                    method
                  ];

                return (
                  <div
                    key={method}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {label}
                    </p>

                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-500">
                          Operaciones
                        </span>

                        <span className="font-medium text-slate-900">
                          {detail
                            ?.operation_count ||
                            0}
                        </span>
                      </div>

                      <div className="flex justify-between gap-4">
                        <span className="text-slate-500">
                          Volumen
                        </span>

                        <span className="font-medium text-slate-900">
                          {formatMoney(
                            detail
                              ?.gross_amount ||
                              0
                          )}
                        </span>
                      </div>

                      <div className="flex justify-between gap-4">
                        <span className="text-slate-500">
                          Comisión
                        </span>

                        <span className="font-semibold text-emerald-700">
                          {formatMoney(
                            detail
                              ?.partner_commission ||
                              0
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Operaciones
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Detalle de las operaciones
                que generan tus comisiones.
              </p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">
                  Comercio
                </label>

                <select
                  value={
                    merchantFilter
                  }
                  onChange={(event) =>
                    setMerchantFilter(
                      event.target.value
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                >
                  <option value="">
                    Todos los comercios
                  </option>

                  {Array.from(
                    new Map(
                      operations.map(
                        (operation) => [
                          operation.merchant_id,
                          operation.merchant_name,
                        ]
                      )
                    )
                  ).map(
                    ([id, name]) => (
                      <option
                        key={id || name}
                        value={id || ""}
                      >
                        {name}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">
                  Medio de pago
                </label>

                <select
                  value={
                    paymentMethodFilter
                  }
                  onChange={(event) =>
                    setPaymentMethodFilter(
                      event.target.value
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                >
                  <option value="">
                    Todos los medios
                  </option>

                  <option value="QR">
                    QR
                  </option>

                  <option value="DEBIT">
                    Débito
                  </option>

                  <option value="CREDIT">
                    Crédito
                  </option>

                  <option value="PREPAID">
                    Prepaga
                  </option>
                </select>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">
                        Fecha
                      </th>

                      <th className="px-4 py-3">
                        Comercio
                      </th>

                      <th className="px-4 py-3">
                        Operación
                      </th>

                      <th className="px-4 py-3">
                        Medio
                      </th>

                      <th className="px-4 py-3 text-right">
                        Bruto
                      </th>

                      <th className="px-4 py-3 text-right">
                        Comisión %
                      </th>

                      <th className="px-4 py-3 text-right">
                        Comisión
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredOperations.length ===
                    0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-8 text-center text-slate-500"
                        >
                          No hay operaciones
                          para los filtros
                          seleccionados.
                        </td>
                      </tr>
                    ) : (
                      filteredOperations.map(
                        (operation) => (
                          <tr
                            key={
                              operation.id
                            }
                            className="hover:bg-slate-50"
                          >
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {operation.transaction_datetime
                                ? new Date(
                                    operation.transaction_datetime
                                  ).toLocaleString(
                                    "es-AR",
                                    {
                                      day: "2-digit",
                                      month:
                                        "2-digit",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute:
                                        "2-digit",
                                    }
                                  )
                                : "-"}
                            </td>

                            <td className="px-4 py-3 font-medium text-slate-900">
                              {
                                operation.merchant_name
                              }
                            </td>

                            <td className="px-4 py-3 text-slate-700">
                              {operation.operation_number ||
                                "-"}
                            </td>

                            <td className="px-4 py-3 text-slate-700">
                              {operation.payment_method ===
                              "DEBIT"
                                ? "Débito"
                                : operation.payment_method ===
                                    "CREDIT"
                                  ? "Crédito"
                                  : operation.payment_method ===
                                      "PREPAID"
                                    ? "Prepaga"
                                    : operation.payment_method ||
                                      "-"}
                            </td>

                            <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-slate-900">
                              {formatMoney(
                                operation.gross_amount
                              )}
                            </td>

                            <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                              {operation.commission_rate.toLocaleString(
                                "es-AR",
                                {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 4,
                                }
                              )}
                              %
                            </td>

                            <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-emerald-700">
                              {formatMoney(
                                operation.partner_commission
                              )}
                            </td>
                          </tr>
                        )
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {summary.status ===
              "PAID" &&
              summary.paid_at && (
                <p className="mt-4 text-sm text-slate-500">
                  Liquidación pagada el{" "}
                  <strong className="font-medium text-slate-700">
                    {new Date(
                      summary.paid_at
                    ).toLocaleDateString(
                      "es-AR"
                    )}
                  </strong>
                  .
                </p>
              )}
          </div>
        </>
      )}
    </div>
  );
}