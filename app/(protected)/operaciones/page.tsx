"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

type Transaction = {
  id: string;
  pos_id: string | null;
  merchant_id_benefi: string | null;
  merchant_branch_id_benefi: string | null;

  transaction_id: string;
  operation_id: string | null;
  operation_number: string | null;

  serial_number: string | null;
  operation_type: string | null;
  payment_method: string | null;

  gross_amount: number | null;
  currency: string | null;
  transaction_datetime: string | null;
  status: string | null;

  installments: number | null;
  financing: string | null;
  acquirer: string | null;
};

type Merchant = {
  id: string;
  name: string | null;
};

type MerchantBranch = {
  id: string;
  merchant_id: string;
  branch_number: number;
  branch_name: string | null;
};

type PosDevice = {
  id: string;
  code: string | null;
  serial: string | null;
  merchant_id: string | null;
  merchant_branch_id: string | null;
};

type SyncResponse = {
  ok?: boolean;
  error?: string;

  summary?: {
    received_from_menta?: number;
    total_elements_menta?: number | null;
    total_pages_menta?: number;
    synced?: number;
    without_pos?: number;
    skipped?: number;
    errors?: number;
  };
};

function startOfCurrentMonth() {
  const now = new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}-01`;
}

function today() {
  const now = new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}-${String(now.getDate()).padStart(
    2,
    "0"
  )}`;
}

function formatMoney(
  amount: number,
  currency = "ARS"
) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: currency || "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDateTime(value: string | null) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalize(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function isApproved(transaction: Transaction) {
  return normalize(transaction.status) === "APPROVED";
}

function isRejected(transaction: Transaction) {
  return normalize(transaction.status) === "REJECTED";
}

function isRefundOrCancellation(transaction: Transaction) {
  const operationType = normalize(
    transaction.operation_type
  );

  const amount = Number(transaction.gross_amount || 0);

  return (
    amount < 0 ||
    operationType.includes("REFUND") ||
    operationType.includes("CANCEL") ||
    operationType.includes("VOID") ||
    operationType.includes("REVERS")
  );
}

function operationLabel(transaction: Transaction) {
  if (isRefundOrCancellation(transaction)) {
    return "Devolución / anulación";
  }

  const operationType = normalize(
    transaction.operation_type
  );

  if (operationType === "PAYMENT") {
    return "Pago";
  }

  return transaction.operation_type || "Operación";
}

function paymentMethodLabel(value: string | null) {
  switch (normalize(value)) {
    case "CREDIT":
      return "Crédito";

    case "DEBIT":
      return "Débito";

    case "QR":
      return "QR";

    default:
      return value || "-";
  }
}

function statusLabel(value: string | null) {
  switch (normalize(value)) {
    case "APPROVED":
      return "Aprobada";

    case "REJECTED":
      return "Rechazada";

    default:
      return value || "Sin estado";
  }
}

export default function OperacionesPage() {
  const [transactions, setTransactions] = useState<
    Transaction[]
  >([]);

  const [merchants, setMerchants] = useState<Merchant[]>(
    []
  );

  const [branches, setBranches] = useState<
    MerchantBranch[]
  >([]);

  const [posDevices, setPosDevices] = useState<
    PosDevice[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [message, setMessage] = useState("");
  const [lastSync, setLastSync] = useState<Date | null>(
    null
  );

  const [dateFrom, setDateFrom] = useState(today());

  const [dateTo, setDateTo] = useState(today());

  const [merchantFilter, setMerchantFilter] =
    useState("");

  const [posFilter, setPosFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] =
    useState("");

  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
  "/api/operaciones",
  {
    method: "GET",
    cache: "no-store",
  }
);

const data = await response.json();

if (!response.ok || !data.ok) {
  throw new Error(
    data.error ||
      "No se pudieron cargar las operaciones."
  );
}

setTransactions(
  (data.transactions || []) as Transaction[]
);

setMerchants(
  (data.merchants || []) as Merchant[]
);

setBranches(
  (data.branches || []) as MerchantBranch[]
);

setPosDevices(
  (data.posDevices || []) as PosDevice[]
);
    } catch (error) {
      console.error(
        "Error cargando operaciones:",
        error
      );

      setMessage(
        error instanceof Error
          ? `Error: ${error.message}`
          : "Error: no se pudieron cargar las operaciones."
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
      branches.map((branch) => [branch.id, branch])
    );
  }, [branches]);

  const posMap = useMemo(() => {
  return new Map(
    posDevices.map((pos) => [pos.id, pos])
  );
}, [posDevices]);

const filteredPosDevices = useMemo(() => {
  if (!merchantFilter) {
    return posDevices;
  }

  return posDevices.filter(
    (pos) => pos.merchant_id === merchantFilter
  );
}, [posDevices, merchantFilter]);

const filteredTransactions = useMemo(() => {
    const searchText = search
      .trim()
      .toLowerCase();

    const from = dateFrom
      ? new Date(`${dateFrom}T00:00:00`)
      : null;

    const to = dateTo
      ? new Date(`${dateTo}T23:59:59.999`)
      : null;

    return transactions.filter((transaction) => {
      if (transaction.transaction_datetime) {
        const transactionDate = new Date(
          transaction.transaction_datetime
        );

        if (
          from &&
          transactionDate.getTime() < from.getTime()
        ) {
          return false;
        }

        if (
          to &&
          transactionDate.getTime() > to.getTime()
        ) {
          return false;
        }
      }

      if (
        merchantFilter &&
        transaction.merchant_id_benefi !==
          merchantFilter
      ) {
        return false;
      }

      if (
        posFilter &&
        transaction.pos_id !== posFilter
      ) {
        return false;
      }

      if (
        statusFilter &&
        normalize(transaction.status) !==
          statusFilter
      ) {
        return false;
      }

      if (
        paymentFilter &&
        normalize(transaction.payment_method) !==
          paymentFilter
      ) {
        return false;
      }

      if (searchText) {
        const merchant = transaction.merchant_id_benefi
          ? merchantMap.get(
              transaction.merchant_id_benefi
            )
          : null;

        const branch =
          transaction.merchant_branch_id_benefi
            ? branchMap.get(
                transaction.merchant_branch_id_benefi
              )
            : null;

        const pos = transaction.pos_id
          ? posMap.get(transaction.pos_id)
          : null;

        const searchable = [
          merchant?.name,
          branch?.branch_name,
          pos?.code,
          pos?.serial,
          transaction.serial_number,
          transaction.operation_number,
          transaction.operation_id,
          transaction.transaction_id,
          transaction.acquirer,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!searchable.includes(searchText)) {
          return false;
        }
      }

      return true;
    });
  }, [
    transactions,
    dateFrom,
    dateTo,
    merchantFilter,
    posFilter,
    statusFilter,
    paymentFilter,
    search,
    merchantMap,
    branchMap,
    posMap,
  ]);

  const metrics = useMemo(() => {
    let approvedSales = 0;
    let refunds = 0;
    let rejected = 0;
    let net = 0;

    let approvedSalesCount = 0;
    let refundCount = 0;

    filteredTransactions.forEach((transaction) => {
      const amount = Number(
        transaction.gross_amount || 0
      );

      if (isRejected(transaction)) {
        rejected++;
        return;
      }

      if (!isApproved(transaction)) {
        return;
      }

      net += amount;

      if (isRefundOrCancellation(transaction)) {
        refunds += Math.abs(amount);
        refundCount++;
      } else {
        approvedSales += amount;
        approvedSalesCount++;
      }
    });

    return {
      approvedSales,
      approvedSalesCount,
      refunds,
      refundCount,
      rejected,
      net,
    };
  }, [filteredTransactions]);

  const handleExportExcel = () => {
  if (filteredTransactions.length === 0) {
    setMessage(
      "Error: no hay operaciones para exportar con los filtros seleccionados."
    );
    return;
  }

  const rows = filteredTransactions.map(
    (transaction) => {
      const merchant = transaction.merchant_id_benefi
        ? merchantMap.get(
            transaction.merchant_id_benefi
          )
        : null;

      const branch =
        transaction.merchant_branch_id_benefi
          ? branchMap.get(
              transaction.merchant_branch_id_benefi
            )
          : null;

      const pos = transaction.pos_id
        ? posMap.get(transaction.pos_id)
        : null;

      return {
        "Fecha / hora": formatDateTime(
          transaction.transaction_datetime
        ),

        Comercio:
          merchant?.name || "Sin vincular",

        Sucursal:
          branch?.branch_name || "Casa central",

        POS:
          pos?.code || "Sin vincular",

        Serial:
          transaction.serial_number ||
          pos?.serial ||
          "",

        "N° operación":
          transaction.operation_number || "",

        "ID operación":
          transaction.operation_id || "",

        "ID transacción MENTA":
          transaction.transaction_id,

        "Tipo de operación":
          operationLabel(transaction),

        "Medio de pago":
          paymentMethodLabel(
            transaction.payment_method
          ),

        Cuotas:
          transaction.installments || "",

        Financiación:
          transaction.financing || "",

        Importe:
          Number(
            transaction.gross_amount || 0
          ),

        Moneda:
          transaction.currency || "ARS",

        Estado:
          statusLabel(transaction.status),

        Adquirente:
          transaction.acquirer || "",
      };
    }
  );

  const worksheet =
    XLSX.utils.json_to_sheet(rows);

  worksheet["!cols"] = [
    { wch: 20 },
    { wch: 28 },
    { wch: 24 },
    { wch: 12 },
    { wch: 22 },
    { wch: 18 },
    { wch: 24 },
    { wch: 38 },
    { wch: 24 },
    { wch: 18 },
    { wch: 10 },
    { wch: 18 },
    { wch: 16 },
    { wch: 10 },
    { wch: 14 },
    { wch: 16 },
  ];

  const workbook =
    XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    "Operaciones"
  );

  const comercioNombre = merchantFilter
    ? merchantMap.get(merchantFilter)?.name
    : null;

  const comercioArchivo = comercioNombre
    ? `_${comercioNombre
        .replace(/[^a-zA-Z0-9]/g, "_")
        .replace(/_+/g, "_")}`
    : "";

  const fileName =
    `operaciones_benefi${comercioArchivo}_${dateFrom}_${dateTo}.xlsx`;

  XLSX.writeFile(
    workbook,
    fileName
  );
};

  const handleSync = async () => {
    setSyncing(true);
    setMessage("");

    try {
      const response = await fetch(
        "/api/menta/transactions/sync",
        {
          method: "POST",
        }
      );

      const data =
        (await response.json()) as SyncResponse;

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error ||
            "No se pudo sincronizar con MENTA."
        );
      }

      const received =
        data.summary?.received_from_menta ?? 0;

      const synced = data.summary?.synced ?? 0;

      setLastSync(new Date());

      setMessage(
        `Sincronización completada. MENTA informó ${received} operaciones y ${synced} fueron procesadas correctamente.`
      );

      await loadData();
    } catch (error) {
      console.error(
        "Error sincronizando MENTA:",
        error
      );

      setMessage(
        error instanceof Error
          ? `Error: ${error.message}`
          : "Error: no se pudo sincronizar con MENTA."
      );
    } finally {
      setSyncing(false);
    }
  };

  const clearFilters = () => {
    setDateFrom(today());
    setDateTo(today());
    setMerchantFilter("");
    setPosFilter("");
    setStatusFilter("");
    setPaymentFilter("");
    setSearch("");
  };

  useEffect(() => {
  if (!posFilter) {
    return;
  }

  const selectedPos = posDevices.find(
    (pos) => pos.id === posFilter
  );

  if (!selectedPos) {
    setPosFilter("");
    return;
  }

  if (
    merchantFilter &&
    selectedPos.merchant_id !== merchantFilter
  ) {
    setPosFilter("");
  }
}, [
  merchantFilter,
  posFilter,
  posDevices,
]);
  return (
    <main className="min-h-screen min-w-0 overflow-x-hidden bg-slate-50 p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 md:text-3xl">
            Operaciones
          </h1>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Consulta y seguimiento de las operaciones
            procesadas mediante los POS BENEFÍ.
          </p>

          {lastSync && (
            <p className="mt-1 text-xs text-slate-400">
              Última sincronización realizada:{" "}
              {lastSync.toLocaleString("es-AR")}
            </p>
          )}
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button
                type="button"
                onClick={handleExportExcel}
                disabled={
                loading ||
                filteredTransactions.length === 0
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
                Exportar Excel
            </button>
            <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="w-full rounded-xl bg-[#1E3A5F] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
            {syncing
                ? "Sincronizando..."
                : "Sincronizar con MENTA"}
            </button>
      </div>
     </div>
      {message && (
        <div
          className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
            message.startsWith("Error")
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {message}
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Procesamiento neto"
          value={formatMoney(metrics.net)}
          subtitle="Aprobadas menos devoluciones"
        />

        <MetricCard
          title="Ventas aprobadas"
          value={formatMoney(metrics.approvedSales)}
          subtitle={`${metrics.approvedSalesCount} operaciones`}
        />

        <MetricCard
          title="Devoluciones / anulaciones"
          value={formatMoney(metrics.refunds)}
          subtitle={`${metrics.refundCount} operaciones`}
        />

        <MetricCard
          title="Rechazadas"
          value={String(metrics.rejected)}
          subtitle="Operaciones no aprobadas"
        />
      </div>

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="mb-4">
          <h2 className="font-semibold text-slate-950">
            Filtros
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Los indicadores y el listado se actualizan
            según los filtros seleccionados.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <FilterField label="Desde">
            <input
              type="date"
              value={dateFrom}
              onChange={(event) =>
                setDateFrom(event.target.value)
              }
              className={inputClass}
            />
          </FilterField>

          <FilterField label="Hasta">
            <input
              type="date"
              value={dateTo}
              onChange={(event) =>
                setDateTo(event.target.value)
              }
              className={inputClass}
            />
          </FilterField>

          <FilterField label="Comercio">
            <select
              value={merchantFilter}
              onChange={(event) =>
                setMerchantFilter(event.target.value)
              }
              className={inputClass}
            >
              <option value="">
                Todos los comercios
              </option>

              {merchants.map((merchant) => (
                <option
                  key={merchant.id}
                  value={merchant.id}
                >
                  {merchant.name || "Sin nombre"}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="POS">
            <select
              value={posFilter}
              onChange={(event) =>
                setPosFilter(event.target.value)
              }
              className={inputClass}
            >
              <option value="">Todos los POS</option>

              {filteredPosDevices.map((pos) => (
                <option key={pos.id} value={pos.id}>
                    {pos.code ||
                    pos.serial ||
                    "POS sin código"}
                </option>
                ))}
            </select>
          </FilterField>

          <FilterField label="Estado">
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
              className={inputClass}
            >
              <option value="">Todos</option>
              <option value="APPROVED">
                Aprobadas
              </option>
              <option value="REJECTED">
                Rechazadas
              </option>
            </select>
          </FilterField>

          <FilterField label="Medio de pago">
            <select
              value={paymentFilter}
              onChange={(event) =>
                setPaymentFilter(event.target.value)
              }
              className={inputClass}
            >
              <option value="">Todos</option>
              <option value="DEBIT">Débito</option>
              <option value="CREDIT">Crédito</option>
              <option value="QR">QR</option>
            </select>
          </FilterField>

          <FilterField
            label="Buscar"
            className="md:col-span-2"
          >
            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              className={inputClass}
              placeholder="Operación, POS, comercio, serial..."
            />
          </FilterField>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={clearFilters}
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:w-auto"
          >
            Limpiar filtros
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-4 md:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-950">
                Detalle de operaciones
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                {filteredTransactions.length} operaciones
                encontradas
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Cargando operaciones...
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No se encontraron operaciones para los
            filtros seleccionados.
          </div>
        ) : (
          <>
            <div className="hidden max-h-[620px] overflow-auto lg:block">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-sm">
                  <tr>
                    <th className="px-4 py-3">
                      Fecha / hora
                    </th>

                    <th className="px-4 py-3">
                      Comercio
                    </th>

                    <th className="px-4 py-3">
                      POS
                    </th>

                    <th className="px-4 py-3">
                      Operación
                    </th>

                    <th className="px-4 py-3">
                      Medio
                    </th>

                    <th className="px-4 py-3 text-center">
                      Cuotas
                    </th>

                    <th className="px-4 py-3 text-right">
                      Importe
                    </th>

                    <th className="px-4 py-3">
                      Estado
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredTransactions.map(
                    (transaction) => (
                      <OperationRow
                        key={transaction.id}
                        transaction={transaction}
                        merchant={
                          transaction.merchant_id_benefi
                            ? merchantMap.get(
                                transaction.merchant_id_benefi
                              ) || null
                            : null
                        }
                        branch={
                          transaction.merchant_branch_id_benefi
                            ? branchMap.get(
                                transaction.merchant_branch_id_benefi
                              ) || null
                            : null
                        }
                        pos={
                          transaction.pos_id
                            ? posMap.get(
                                transaction.pos_id
                              ) || null
                            : null
                        }
                      />
                    )
                  )}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 lg:hidden">
              {filteredTransactions.map(
                (transaction) => (
                  <OperationCard
                    key={transaction.id}
                    transaction={transaction}
                    merchant={
                      transaction.merchant_id_benefi
                        ? merchantMap.get(
                            transaction.merchant_id_benefi
                          ) || null
                        : null
                    }
                    branch={
                      transaction.merchant_branch_id_benefi
                        ? branchMap.get(
                            transaction.merchant_branch_id_benefi
                          ) || null
                        : null
                    }
                    pos={
                      transaction.pos_id
                        ? posMap.get(
                            transaction.pos_id
                          ) || null
                        : null
                    }
                  />
                )
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10";

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
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {title}
      </p>

      <p className="mt-2 break-words text-2xl font-bold text-slate-950">
        {value}
      </p>

      <p className="mt-1 text-xs text-slate-500">
        {subtitle}
      </p>
    </div>
  );
}

function FilterField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-medium text-slate-600">
        {label}
      </label>

      {children}
    </div>
  );
}

function OperationRow({
  transaction,
  merchant,
  branch,
  pos,
}: {
  transaction: Transaction;
  merchant: Merchant | null;
  branch: MerchantBranch | null;
  pos: PosDevice | null;
}) {
  const refund =
    isRefundOrCancellation(transaction);

  return (
    <tr className="hover:bg-slate-50/70">
      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
        {formatDateTime(
          transaction.transaction_datetime
        )}
      </td>

      <td className="px-4 py-3">
        <p className="font-medium text-slate-900">
          {merchant?.name || "Sin vincular"}
        </p>

        <p className="mt-0.5 text-xs text-slate-500">
          {branch?.branch_name || "Casa central"}
        </p>
      </td>

      <td className="px-4 py-3">
        <p className="font-medium text-slate-800">
          {pos?.code || "Sin vincular"}
        </p>

        <p className="mt-0.5 text-xs text-slate-400">
          {transaction.serial_number || pos?.serial || "-"}
        </p>
      </td>

      <td className="px-4 py-3">
        <p
          className={
            refund
              ? "font-medium text-amber-700"
              : "font-medium text-slate-800"
          }
        >
          {operationLabel(transaction)}
        </p>

        <p className="mt-0.5 text-xs text-slate-400">
          N° {transaction.operation_number || "-"}
        </p>
      </td>

      <td className="px-4 py-3 text-slate-700">
        {paymentMethodLabel(
          transaction.payment_method
        )}
      </td>

      <td className="px-4 py-3 text-center text-slate-700">
        {transaction.installments || "-"}
      </td>

      <td
        className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${
          refund
            ? "text-amber-700"
            : "text-slate-950"
        }`}
      >
        {formatMoney(
          Number(transaction.gross_amount || 0),
          transaction.currency || "ARS"
        )}
      </td>

      <td className="px-4 py-3">
        <StatusBadge status={transaction.status} />
      </td>
    </tr>
  );
}

function OperationCard({
  transaction,
  merchant,
  branch,
  pos,
}: {
  transaction: Transaction;
  merchant: Merchant | null;
  branch: MerchantBranch | null;
  pos: PosDevice | null;
}) {
  const refund =
    isRefundOrCancellation(transaction);

  return (
    <article className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-950">
            {merchant?.name || "Sin vincular"}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {branch?.branch_name || "Casa central"} ·{" "}
            {pos?.code || "POS sin vincular"}
          </p>
        </div>

        <StatusBadge status={transaction.status} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <MobileDetail
          label="Fecha"
          value={formatDateTime(
            transaction.transaction_datetime
          )}
        />

        <MobileDetail
          label="Medio"
          value={paymentMethodLabel(
            transaction.payment_method
          )}
        />

        <MobileDetail
          label="Operación"
          value={operationLabel(transaction)}
        />

        <MobileDetail
          label="Cuotas"
          value={
            transaction.installments
              ? String(transaction.installments)
              : "-"
          }
        />

        <MobileDetail
          label="N° operación"
          value={transaction.operation_number || "-"}
        />

        <MobileDetail
          label="Serial"
          value={
            transaction.serial_number ||
            pos?.serial ||
            "-"
          }
        />
      </div>

      <div className="mt-4 border-t border-slate-100 pt-3">
        <p className="text-xs text-slate-500">
          Importe
        </p>

        <p
          className={`mt-1 text-xl font-bold ${
            refund
              ? "text-amber-700"
              : "text-slate-950"
          }`}
        >
          {formatMoney(
            Number(transaction.gross_amount || 0),
            transaction.currency || "ARS"
          )}
        </p>
      </div>
    </article>
  );
}

function MobileDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs text-slate-400">
        {label}
      </p>

      <p className="mt-0.5 break-words font-medium text-slate-700">
        {value}
      </p>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string | null;
}) {
  const normalized = normalize(status);

  if (normalized === "APPROVED") {
    return (
      <span className="inline-flex whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
        Aprobada
      </span>
    );
  }

  if (normalized === "REJECTED") {
    return (
      <span className="inline-flex whitespace-nowrap rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
        Rechazada
      </span>
    );
  }

  return (
    <span className="inline-flex whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
      {statusLabel(status)}
    </span>
  );
}