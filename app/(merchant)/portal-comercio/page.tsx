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

type MonthlySale = {
  merchant_id_benefi: string;
  month_start: string;
  operation_count: number | string;
  gross_amount: number | string | null;
};

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

function today() {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

export default function ComercioDashboardPage() {
  const [liquidations, setLiquidations] =
    useState<Liquidation[]>([]);

  const [merchants, setMerchants] =
    useState<Merchant[]>([]);
  

  const [monthlySales, setMonthlySales] =
    useState<MonthlySale[]>([]);

  const [scope, setScope] =
  useState<{
    type: string;
    id: string;
    name: string;
  } | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState("");

  useEffect(() => {
    async function loadDashboard() {
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
              "No se pudo cargar el Portal Comercio."
          );
        }

        setLiquidations(
          data.liquidations || []
        );

        setMerchants(
          data.merchants || []
        );

        setScope(data.scope || null);

        setMonthlySales(
          data.monthlySales || []
        );
      } catch (error) {
        console.error(
          "Error cargando Portal Comercio:",
          error
        );

        setMessage(
          error instanceof Error
            ? error.message
            : "No se pudo cargar el Portal Comercio."
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  const metrics = useMemo(() => {
    const currentDate = today();

    const salesAmount =
      monthlySales.reduce(
        (total, item) =>
          total +
          toNumber(item.gross_amount),
        0
      );

    const operationCount =
      monthlySales.reduce(
        (total, item) =>
          total +
          toNumber(
            item.operation_count
          ),
        0
      );

    const futureLiquidations =
      liquidations
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

    const netToCredit =
      futureLiquidations.reduce(
        (total, item) =>
          total +
          toNumber(
            item.merchant_net_amount
          ),
        0
      );

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
      salesAmount,
      operationCount,
      netToCredit,
      nextDate,
      nextAmount,
    };
  }, [
    liquidations,
    monthlySales,
  ]);

  const merchantName =
    merchants.length === 1
      ? merchants[0].name
      : merchants.length > 1
        ? `${merchants.length} comercios`
        : "Sin comercio asignado";

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">
          Portal Comercio
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Resumen de tus operaciones y acreditaciones.
        </p>

        {scope?.type === "group" ? (
        <div className="mt-2">
              <p className="text-sm font-semibold text-slate-800">
                {scope.name}
              </p>

              <p className="mt-0.5 text-sm text-slate-600">
                {merchants.length} comercios en la red
              </p>

              {merchants.length > 0 && (
                <p className="mt-0.5 text-xs text-slate-500">
                  {merchants
                    .map((merchant) => merchant.name)
                    .join(" · ")}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm font-medium text-slate-700">
              Comercio: {merchantName}
            </p>
          )}
        </div>

      {message && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">
            Ventas del mes
          </div>

          <div className="mt-2 text-2xl font-bold text-slate-950">
            {loading
              ? "..."
              : formatMoney(
                  metrics.salesAmount
                )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">
            Neto a acreditar
          </div>

          <div className="mt-2 text-2xl font-bold text-slate-950">
            {loading
              ? "..."
              : formatMoney(
                  metrics.netToCredit
                )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">
            Próxima acreditación
          </div>

          <div className="mt-2 text-2xl font-bold text-slate-950">
            {loading
              ? "..."
              : formatDate(
                  metrics.nextDate
                )}
          </div>

          {!loading &&
            metrics.nextDate && (
              <div className="mt-1 text-sm text-slate-500">
                {formatMoney(
                  metrics.nextAmount
                )}
              </div>
            )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">
            Operaciones
          </div>

          <div className="mt-2 text-2xl font-bold text-slate-950">
            {loading
              ? "..."
              : metrics.operationCount}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4">
          <h2 className="text-base font-bold text-slate-950">
            Últimas liquidaciones
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Últimas acreditaciones correspondientes a tus comercios.
          </p>
        </div>

        {loading ? (
          <div className="py-6 text-sm text-slate-500">
            Cargando liquidaciones...
          </div>
        ) : liquidations.length === 0 ? (
          <div className="py-6 text-sm text-slate-500">
            No hay liquidaciones disponibles.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3 text-left font-semibold">
                    Fecha pago
                  </th>

                  <th className="px-3 py-3 text-right font-semibold">
                    Operaciones
                  </th>

                  <th className="px-3 py-3 text-right font-semibold">
                    POS
                  </th>

                  <th className="px-3 py-3 text-right font-semibold">
                    Bruto
                  </th>

                  <th className="px-3 py-3 text-right font-semibold">
                    Neto
                  </th>
                </tr>
              </thead>

              <tbody>
                {liquidations
                  .filter(
                    (item) =>
                      item.merchant_payment_date <= today()
                  )
                  .slice(0, 5)
                  .map((item, index) => (
                    <tr
                      key={[
                        item.merchant_id_benefi,
                        item.merchant_payment_date,
                        index,
                      ].join("-")}
                      className="border-t border-slate-100 text-sm text-slate-700"
                    >
                      <td className="px-3 py-3">
                        {formatDate(
                          item.merchant_payment_date
                        )}
                      </td>

                      <td className="px-3 py-3 text-right">
                        {toNumber(
                          item.operation_count
                        )}
                      </td>

                      <td className="px-3 py-3 text-right">
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

                      <td className="px-3 py-3 text-right">
                        {formatMoney(
                          item.gross_amount
                        )}
                      </td>

                      <td className="px-3 py-3 text-right font-semibold text-slate-950">
                        {formatMoney(
                          item.merchant_net_amount
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}