"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

type Liquidation = {
  merchant_id_benefi: string | null;
  merchant_payment_date: string;
  operation_count: number | string;
  pos_count: number | string;
  pos_codes: string | null;
  gross_amount: number | string | null;
  merchant_net_amount: number | string | null;
};

type Merchant = {
  id: string;
  name: string;
};

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
    String(lastDay.getMonth() + 1).padStart(2, "0"),
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

export default function PortalComercioLiquidacionesPage() {
  const [liquidations, setLiquidations] =
    useState<Liquidation[]>([]);

  const [merchants, setMerchants] =
    useState<Merchant[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState("");

  const [dateFrom, setDateFrom] =
    useState(firstDayOfMonth());

  const [dateTo, setDateTo] =
    useState(lastDayOfMonth());

  useEffect(() => {
    async function loadLiquidations() {
      setLoading(true);
      setMessage("");

      try {
        const response = await fetch(
          "/api/portal-comercio/dashboard",
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
          data.liquidations || []
        );

        setMerchants(
          data.merchants || []
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
    }

    loadLiquidations();
  }, []);

  const filteredLiquidations =
    useMemo(() => {
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

        return true;
      });
    }, [
      liquidations,
      dateFrom,
      dateTo,
    ]);

  const merchantName =
    merchants.length === 1
      ? merchants[0].name
      : merchants.length > 1
        ? `${merchants.length} comercios`
        : "Sin comercio asignado";
  
  const showMerchantColumn =
    merchants.length > 1;

  function getMerchantName(
    merchantId: string | null
  ) {
    if (!merchantId) {
      return "-";
    }

    return (
      merchants.find(
        (merchant) =>
          merchant.id === merchantId
      )?.name || "-"
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-950 md:text-3xl">
          Liquidaciones
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Consulta las acreditaciones correspondientes
          a tus operaciones.
        </p>

        <p className="mt-2 text-sm font-medium text-slate-700">
          Comercio: {merchantName}
        </p>
      </div>

      {message && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      )}

      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">
          Filtros
        </h2>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
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
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
            />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Detalle de liquidaciones
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {filteredLiquidations.length} liquidaciones encontradas
          </p>
        </div>

        {loading ? (
          <div className="px-4 py-12 text-center text-sm text-slate-500">
            Cargando liquidaciones...
          </div>
        ) : filteredLiquidations.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-500">
            No hay liquidaciones para el período seleccionado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] border-collapse">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">
                    Fecha pago
                  </th>

                  {showMerchantColumn && (
                    <th className="px-4 py-3 text-left font-semibold">
                      Comercio
                    </th>
                  )}

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

                  <th className="px-4 py-3 text-right font-semibold">
                    Acción
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredLiquidations.map(
                  (item, index) => (
                    <tr
                      key={[
                        item.merchant_id_benefi,
                        item.merchant_payment_date,
                        index,
                      ].join("-")}
                      className="border-t border-slate-100 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <td className="px-4 py-3">
                        {formatDate(
                          item.merchant_payment_date
                        )}
                      </td>

                      {showMerchantColumn && (
                        <td className="px-4 py-3">
                          <span className="font-medium text-slate-900">
                            {getMerchantName(
                              item.merchant_id_benefi
                            )}
                          </span>
                        </td>
                      )}

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

                      <td className="px-4 py-3 text-right">
                        {formatMoney(
                          item.gross_amount
                        )}
                      </td>

                      <td className="px-4 py-3 text-right font-bold text-slate-950">
                        {formatMoney(
                          item.merchant_net_amount
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        {item.merchant_id_benefi ? (
                            <a
                            href={`/portal-comercio/liquidaciones/detalle?merchant_id=${encodeURIComponent(
                                item.merchant_id_benefi
                            )}&payment_date=${encodeURIComponent(
                                item.merchant_payment_date
                            )}`}
                            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                            Ver detalle
                            </a>
                        ) : (
                            <span className="text-xs text-slate-400">
                            -
                            </span>
                        )}
                        </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}