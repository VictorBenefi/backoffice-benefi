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
    saved_operation_count: number | null;
    saved_gross_amount: number | null;
    saved_commission_amount: number | null;
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

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;
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

function isPastMonth(month: string) {
  const now = new Date();

  const currentMonth =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "America/Argentina/Buenos_Aires",
        year: "numeric",
        month: "2-digit",
      }
    ).format(now);

  return month < currentMonth;
}

export default function LiquidacionesPartnersPage() {
  const [month, setMonth] = useState(
    getCurrentMonth()
  );

  const [summaries, setSummaries] =
    useState<PartnerSummary[]>([]);

const [operations, setOperations] =
  useState<PartnerOperation[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

const [
  closingPartnerId,
  setClosingPartnerId,
] = useState<string | null>(null);

const [
  liquidationToClose,
  setLiquidationToClose,
] = useState<PartnerSummary | null>(
  null
);

const [
  liquidationToPay,
  setLiquidationToPay,
] = useState<PartnerSummary | null>(
  null
);

const [
  paymentDate,
  setPaymentDate,
] = useState("");

const [
  payingPartnerId,
  setPayingPartnerId,
] = useState<string | null>(null);

const [
  selectedPartnerId,
  setSelectedPartnerId,
] = useState<string | null>(null);

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
          `/api/liquidaciones-partners?month=${month}`,
          {
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "No se pudieron cargar las liquidaciones Partners"
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

  async function closeLiquidation(
  summary: PartnerSummary
) {
  

  try {
    setClosingPartnerId(
      summary.partner_id
    );

    setError("");

    const response = await fetch(
      "/api/liquidaciones-partners",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          merchant_group_id:
            summary.partner_id,
          month,
          operation_count:
            summary.operation_count,
          gross_amount:
            summary.gross_amount,
          commission_amount:
            summary.partner_commission,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "No se pudo cerrar la liquidación"
      );
    }

    setSummaries((current) =>
      current.map((item) =>
        item.partner_id ===
        summary.partner_id
          ? {
              ...item,
              liquidation_id:
                data.liquidation.id,
              status: "CLOSED",
              closed_at:
                data.liquidation
                  .closed_at,
              saved_operation_count:
                Number(
                  data.liquidation
                    .operation_count
                ),
              saved_gross_amount:
                Number(
                  data.liquidation
                    .gross_amount
                ),
              saved_commission_amount:
                Number(
                  data.liquidation
                    .commission_amount
                ),
            }
          : item
      )
    );
  } catch (closeError) {
    setError(
      closeError instanceof Error
        ? closeError.message
        : "Error inesperado al cerrar la liquidación"
    );
  } finally {
    setClosingPartnerId(null);
  }
}

async function registerPayment() {
  if (
    !liquidationToPay ||
    !liquidationToPay.liquidation_id ||
    !paymentDate
  ) {
    return;
  }

  try {
    setPayingPartnerId(
      liquidationToPay.partner_id
    );

    setError("");

    const response = await fetch(
      "/api/liquidaciones-partners",
      {
        method: "PATCH",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          liquidation_id:
            liquidationToPay.liquidation_id,
          paid_at: `${paymentDate}T12:00:00-03:00`,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "No se pudo registrar el pago"
      );
    }

    setSummaries((current) =>
      current.map((item) =>
        item.partner_id ===
        liquidationToPay.partner_id
          ? {
              ...item,
              status: "PAID",
              paid_at:
                data.liquidation.paid_at,
            }
          : item
      )
    );

    setLiquidationToPay(null);
    setPaymentDate("");
  } catch (paymentError) {
    setError(
      paymentError instanceof Error
        ? paymentError.message
        : "Error inesperado al registrar el pago"
    );
  } finally {
    setPayingPartnerId(null);
  }
}
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">
          Liquidaciones Partners
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Comisiones generadas por los
          Partners según el volumen
          procesado.
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
            onChange={(event) =>
              setMonth(
                event.target.value
              )
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">
                  Partner
                </th>

                <th className="px-4 py-3 text-right">
                  Operaciones
                </th>

                <th className="px-4 py-3 text-right">
                  Volumen procesado
                </th>

                <th className="px-4 py-3 text-right">
                  Comisión generada
                </th>

                <th className="px-4 py-3 text-center">
                  Estado
                </th>

                <th className="px-4 py-3 text-right">
                  Acción
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    Cargando liquidaciones...
                  </td>
                </tr>
              ) : summaries.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No hay liquidaciones
                    Partner para este período.
                  </td>
                </tr>
              ) : (
                summaries.map(
                  (summary) => (
                    <tr
                      key={
                        summary.partner_id
                      }
                      className="hover:bg-slate-50"
                    >
                      <td className="px-4 py-4 font-medium text-slate-900">
                        {
                          summary.partner_name
                        }
                      </td>

                      <td className="px-4 py-4 text-right text-slate-700">
                        {
                          summary.operation_count
                        }
                      </td>

                      <td className="px-4 py-4 text-right font-medium text-slate-900">
                        {formatMoney(
                          summary.gross_amount
                        )}
                      </td>

                      <td className="px-4 py-4 text-right font-semibold text-emerald-700">
                        {formatMoney(
                          summary.partner_commission
                        )}
                      </td>

                      <td className="px-4 py-4 text-center">
                        <span
                        className={
                            summary.status === "PAID"
                            ? "inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700"
                            : summary.status === "CLOSED"
                                ? "inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700"
                                : "inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700"
                        }
                        >
                        {summary.status === "PAID"
                            ? "Pagada"
                            : summary.status === "CLOSED"
                            ? "Cerrada"
                            : "Abierta"}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-right">
                        <button
                            type="button"
                            onClick={() =>
                                setSelectedPartnerId(
                                selectedPartnerId ===
                                    summary.partner_id
                                    ? null
                                    : summary.partner_id
                                )
                            }
                            className="font-medium text-slate-700 hover:text-slate-950"
                            >
                            {selectedPartnerId ===
                            summary.partner_id
                                ? "Ocultar detalle"
                                : "Ver detalle"}
                            </button>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
      {selectedPartnerId &&
  summaries
    .filter(
      (summary) =>
        summary.partner_id ===
        selectedPartnerId
    )
    .map((summary) => (
      <div
        key={`detail-${summary.partner_id}`}
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-950">
            Detalle —{" "}
            {summary.partner_name}
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Desglose de la comisión
            generada durante el período
            seleccionado.
          </p>
          {summary.status === "OPEN" && (
            <div className="mt-4">
                <button
                type="button"
                onClick={() =>
                setLiquidationToClose(summary)
                }
                disabled={!isPastMonth(month)}
                className={
                    isPastMonth(month)
                    ? "rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                    : "cursor-not-allowed rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-500"
                }
                >
                {closingPartnerId ===
                summary.partner_id
                ? "Cerrando..."
                : "Cerrar liquidación"}
                </button>

                {!isPastMonth(month) && (
                <p className="mt-2 text-xs text-slate-500">
                    La liquidación podrá cerrarse
                    cuando finalice el período.
                </p>
                )}
            </div>
            )}
            {summary.status === "CLOSED" && (
            <div className="mt-4">
                <button
                type="button"
                onClick={() => {
                    setLiquidationToPay(summary);

                    setPaymentDate(
                    new Date()
                        .toLocaleDateString(
                        "en-CA",
                        {
                            timeZone:
                            "America/Argentina/Buenos_Aires",
                        }
                        )
                    );
                }}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                Registrar pago
                </button>
            </div>
            )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["QR", "QR"],
            ["DEBIT", "Débito"],
            ["CREDIT", "Crédito"],
            ["PREPAID", "Prepaga"],
          ].map(([method, label]) => {
            const detail =
              summary.by_payment_method[
                method
              ];

            return (
              <div
                key={method}
                className="rounded-xl border border-slate-200 p-4"
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
          })}
        </div>
        <div className="mt-6">
            <div className="mb-3">
                <h3 className="text-base font-semibold text-slate-950">
                Operaciones
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                Detalle de las operaciones que
                generan la comisión del Partner.
                </p>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600">
                    Comercio
                    </label>

                    <select
                    value={merchantFilter}
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
                        operations
                            .filter(
                            (operation) =>
                                operation.partner_id ===
                                summary.partner_id
                            )
                            .map((operation) => [
                            operation.merchant_id,
                            operation.merchant_name,
                            ])
                        )
                    ).map(([id, name]) => (
                        <option
                        key={id || name}
                        value={id || ""}
                        >
                        {name}
                        </option>
                    ))}
                    </select>
                </div>

                <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600">
                    Medio de pago
                    </label>

                    <select
                    value={paymentMethodFilter}
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

            <div className="overflow-hidden rounded-xl border border-slate-200">
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
                        Comisión Partner
                        </th>
                    </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                    {operations
                    .filter(
                        (operation) =>
                        operation.partner_id ===
                            summary.partner_id &&
                        (
                            !merchantFilter ||
                            operation.merchant_id ===
                            merchantFilter
                        ) &&
                        (
                            !paymentMethodFilter ||
                            operation.payment_method ===
                            paymentMethodFilter
                        )
                    )
                    .map((operation) => (
                        <tr
                            key={operation.id}
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
                                    month: "2-digit",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    }
                                )
                                : "-"}
                            </td>

                            <td className="px-4 py-3 font-medium text-slate-900">
                            {operation.merchant_name}
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
                        ))}
                    </tbody>
                </table>
                </div>
            </div>
            </div>
      </div>
    ))}
    {liquidationToClose && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div>
            <h2 className="text-lg font-semibold text-slate-950">
            Cerrar liquidación
            </h2>

            <p className="mt-2 text-sm text-slate-500">
            Confirmá los datos antes de
            cerrar la liquidación de{" "}
            <strong className="text-slate-700">
                {
                liquidationToClose.partner_name
                }
            </strong>
            .
            </p>
        </div>

        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between py-1.5 text-sm">
            <span className="text-slate-500">
                Período
            </span>

            <span className="font-medium text-slate-900">
                {new Date(
                `${month}-01T12:00:00`
                ).toLocaleDateString(
                "es-AR",
                {
                    month: "long",
                    year: "numeric",
                }
                )}
            </span>
            </div>

            <div className="flex items-center justify-between py-1.5 text-sm">
            <span className="text-slate-500">
                Operaciones
            </span>

            <span className="font-medium text-slate-900">
                {
                liquidationToClose.operation_count
                }
            </span>
            </div>

            <div className="flex items-center justify-between py-1.5 text-sm">
            <span className="text-slate-500">
                Volumen procesado
            </span>

            <span className="font-medium text-slate-900">
                {formatMoney(
                liquidationToClose.gross_amount
                )}
            </span>
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-3">
            <span className="text-sm font-medium text-slate-700">
                Comisión Partner
            </span>

            <span className="text-base font-semibold text-emerald-700">
                {formatMoney(
                liquidationToClose.partner_commission
                )}
            </span>
            </div>
        </div>

        <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            Al confirmar, estos valores
            quedarán registrados como
            definitivos para este período.
        </div>

        <div className="mt-6 flex justify-end gap-3">
            <button
            type="button"
            disabled={
                closingPartnerId !== null
            }
            onClick={() =>
                setLiquidationToClose(null)
            }
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
            Cancelar
            </button>

            <button
            type="button"
            disabled={
                closingPartnerId !== null
            }
            onClick={async () => {
                await closeLiquidation(
                liquidationToClose
                );

                setLiquidationToClose(
                null
                );
            }}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
            {closingPartnerId
                ? "Cerrando..."
                : "Confirmar cierre"}
            </button>
        </div>
        </div>
    </div>
    )}
    {liquidationToPay && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div>
            <h2 className="text-lg font-semibold text-slate-950">
            Registrar pago
            </h2>

            <p className="mt-2 text-sm text-slate-500">
            Registrá el pago de la
            liquidación de{" "}
            <strong className="text-slate-700">
                {liquidationToPay.partner_name}
            </strong>
            .
            </p>
        </div>

        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between py-1.5 text-sm">
            <span className="text-slate-500">
                Período
            </span>

            <span className="font-medium text-slate-900">
                {new Date(
                `${month}-01T12:00:00`
                ).toLocaleDateString(
                "es-AR",
                {
                    month: "long",
                    year: "numeric",
                }
                )}
            </span>
            </div>

            <div className="flex items-center justify-between py-1.5 text-sm">
            <span className="text-slate-500">
                Operaciones
            </span>

            <span className="font-medium text-slate-900">
                {liquidationToPay.saved_operation_count ??
                liquidationToPay.operation_count}
            </span>
            </div>

            <div className="flex items-center justify-between py-1.5 text-sm">
            <span className="text-slate-500">
                Volumen procesado
            </span>

            <span className="font-medium text-slate-900">
                {formatMoney(
                liquidationToPay.saved_gross_amount ??
                    liquidationToPay.gross_amount
                )}
            </span>
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-3">
            <span className="text-sm font-medium text-slate-700">
                Importe a pagar
            </span>

            <span className="text-base font-semibold text-emerald-700">
                {formatMoney(
                liquidationToPay.saved_commission_amount ??
                    liquidationToPay.partner_commission
                )}
            </span>
            </div>
        </div>

        <div className="mt-5">
            <label className="mb-1 block text-sm font-medium text-slate-700">
            Fecha de pago
            </label>

            <input
            type="date"
            value={paymentDate}
            onChange={(event) =>
                setPaymentDate(
                event.target.value
                )
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
        </div>

        <div className="mt-6 flex justify-end gap-3">
            <button
            type="button"
            onClick={() => {
                setLiquidationToPay(null);
                setPaymentDate("");
            }}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
            Cancelar
            </button>

            <button
            type="button"
            onClick={registerPayment}
            disabled={
                !paymentDate ||
                payingPartnerId !== null
            }
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
            {payingPartnerId
            ? "Registrando..."
            : "Confirmar pago"}
            </button>
        </div>
        </div>
    </div>
    )}
    </div>
  );
}