"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Search } from "lucide-react";

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

  merchant_net_amount: number | null;
  merchant_payment_date: string | null;
  operation_detail: Record<string, unknown> | null;
  tax_info: Record<string, unknown> | null;
};

type PaymentCostSetting = {
  id: string;
  payment_method: "QR" | "DEBIT" | "CREDIT" | "PREPAID";
  acquirer_rate: number;
  menta_rate: number;
  panda_rate: number;
  valid_from: string;
  valid_to: string | null;
  is_active: boolean;
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
  merchant_reference: string | null;
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
    new_operations?: number;
    changed_operations?: number;
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

function formatDate(value: string | null) {
  if (!value) return "-";

  const datePart = value.slice(0, 10);
  const [year, month, day] = datePart.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function normalize(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function getPosDisplay(pos: PosDevice | null) {
  if (!pos) return "Sin vincular";

  const serialSuffix = pos.serial
    ? pos.serial.slice(-5)
    : "-";

  return pos.merchant_reference
    ? `${pos.merchant_reference} / ${serialSuffix}`
    : serialSuffix;
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
  const operationType = normalize(
    transaction.operation_type
  );

  switch (operationType) {
    case "PAYMENT":
      return "Venta";

    case "ANNULMENT":
      return "Anulación";

    case "REFUND":
      return "Devolución";

    default:
      return transaction.operation_type || "Operación";
  }
}

function getCardBrand(
  operationDetail: Record<string, unknown> | null
) {
  if (!operationDetail) return null;

  const card = operationDetail.card;

  if (
    !card ||
    typeof card !== "object" ||
    Array.isArray(card)
  ) {
    return null;
  }

  const cardData = card as Record<string, unknown>;

  const brand =
    typeof cardData.card_brand === "string"
      ? cardData.card_brand
      : null;

  const isInternational =
    cardData.is_international_card === true;

  if (!brand) return null;

  return isInternational
    ? `${brand} (Internacional)`
    : brand;
}

function getOperationDetailValue(
  operationDetail: Record<string, unknown> | null,
  key: string
) {
  if (!operationDetail) {
    return null;
  }

  const value = operationDetail[key];

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  return String(value);
}

function getCardDetailValue(
  operationDetail: Record<string, unknown> | null,
  key: string
) {
  if (!operationDetail) {
    return null;
  }

  const card = operationDetail.card;

  if (
    !card ||
    typeof card !== "object" ||
    Array.isArray(card)
  ) {
    return null;
  }

  const cardData =
    card as Record<string, unknown>;

  const value = cardData[key];

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  return String(value);
}

function getTaxRate(
  taxInfo: Record<string, unknown> | null,
  taxType: string
) {
  if (!taxInfo) return null;

  const taxBreakdown = taxInfo.tax_breakdown;

  if (!Array.isArray(taxBreakdown)) {
    return null;
  }

  const item = taxBreakdown.find((entry) => {
    if (
      !entry ||
      typeof entry !== "object" ||
      Array.isArray(entry)
    ) {
      return false;
    }

    const data = entry as Record<string, unknown>;

    return data.tax_code === taxType;
  });

  if (
    !item ||
    typeof item !== "object" ||
    Array.isArray(item)
  ) {
    return null;
  }

  const data = item as Record<string, unknown>;
  const rate = Number(data.rate);

  return Number.isFinite(rate) ? rate : null;
}

function getMerchantRate(
  transaction: Transaction
) {
  return getTaxRate(
    transaction.tax_info,
    "CUSTOMER_TO_MERCHANT_COMMISSION"
  );
}

function getAcquirerRate(
  transaction: Transaction
) {
  return getTaxRate(
    transaction.tax_info,
    "ACQUIRER_TO_CUSTOMER_COMMISSION"
  );
}

function getPaymentCostSetting(
  transaction: Transaction,
  paymentCosts: PaymentCostSetting[]
) {
  const paymentMethod = normalize(
    transaction.payment_method
  );

  if (!transaction.transaction_datetime) {
    return null;
  }

  const transactionDate =
    transaction.transaction_datetime.slice(0, 10);

  return (
    paymentCosts.find((setting) => {
      if (
        normalize(setting.payment_method) !==
        paymentMethod
      ) {
        return false;
      }

      if (transactionDate < setting.valid_from) {
        return false;
      }

      if (
        setting.valid_to &&
        transactionDate > setting.valid_to
      ) {
        return false;
      }

      return true;
    }) || null
  );
}

function getOperationRates(
  transaction: Transaction,
  paymentCosts: PaymentCostSetting[]
) {
  const paymentMethod = normalize(
    transaction.payment_method
  );

  const setting = getPaymentCostSetting(
    transaction,
    paymentCosts
  );

  if (!setting) {
    return null;
  }

  const grossAmount = Number(
    transaction.gross_amount || 0
  );

  const merchantNetAmount = Number(
    transaction.merchant_net_amount || 0
  );

  if (
    paymentMethod === "QR" &&
    Math.abs(grossAmount - merchantNetAmount) <= 0.01
  ) {
    return {
      merchantRate: 0,
      acquirerRate: 0,
      mentaRate: 0,
      pandaRate: 0,
    };
  }

  const merchantRate =
    getMerchantRate(transaction) ?? 0;

  const acquirerRate =
    paymentMethod === "QR"
      ? Number(setting.acquirer_rate || 0)
      : getAcquirerRate(transaction) ??
        Number(setting.acquirer_rate || 0);

  return {
    merchantRate,
    acquirerRate,
    mentaRate: Number(setting.menta_rate || 0),
    pandaRate: Number(setting.panda_rate || 0),
  };
}

function getOperationEconomics(
  transaction: Transaction,
  paymentCosts: PaymentCostSetting[]
) {
  const isApproved =
  normalize(transaction.status) === "APPROVED";

  const isCancellation =
    isRefundOrCancellation(transaction);

  if (!isApproved || isCancellation) {
    return {
      merchantRate: 0,
      acquirerRate: 0,
      mentaRate: 0,
      pandaRate: 0,
      merchantFee: 0,
      acquirerCost: 0,
      mentaCost: 0,
      pandaCost: 0,
      benefiProfit: 0,
    };
  }

  const rates = getOperationRates(
    transaction,
    paymentCosts
  );

  if (!rates) {
    return null;
  }

  const grossAmount = Number(
    transaction.gross_amount || 0
  );

  const merchantFee =
    grossAmount * (rates.merchantRate / 100);

  const acquirerCost =
    grossAmount * (rates.acquirerRate / 100);

  const mentaCost =
    grossAmount * (rates.mentaRate / 100);

  const pandaCost =
    grossAmount * (rates.pandaRate / 100);

  const benefiProfit =
    merchantFee -
    acquirerCost -
    mentaCost -
    pandaCost;

  return {
    ...rates,
    merchantFee,
    acquirerCost,
    mentaCost,
    pandaCost,
    benefiProfit,
  };
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

    case "REVERSED":
      return "Reversada";

    case "FAILED":
      return "Fallida";

    default:
      return value || "Sin estado";
  }
}

export default function OperacionesPage() {
  const [transactions, setTransactions] = useState<
    Transaction[]
  >([]);

  const [
  selectedTransaction,
  setSelectedTransaction,
] = useState<Transaction | null>(null);

  const [merchants, setMerchants] = useState<Merchant[]>(
    []
  );

  const [branches, setBranches] = useState<
    MerchantBranch[]
  >([]);

  const [posDevices, setPosDevices] = useState<
    PosDevice[]
  >([]);

  const [paymentCosts, setPaymentCosts] = useState<
    PaymentCostSetting[]
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

  const [branchFilter, setBranchFilter] =
  useState("");

  const [posFilter, setPosFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] =
    useState("");

  const [operationTypeFilter, setOperationTypeFilter] =
  useState("");

  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
    const params = new URLSearchParams();

    if (dateFrom) {
      params.set("dateFrom", dateFrom);
    }

    if (dateTo) {
      params.set("dateTo", dateTo);
    }

    const response = await fetch(
      `/api/operaciones?${params.toString()}`,
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

setPaymentCosts(
  (data.paymentCosts || []) as PaymentCostSetting[]
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
  }, [dateFrom, dateTo]);

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
  return posDevices.filter((pos) => {
    if (
      merchantFilter &&
      pos.merchant_id !== merchantFilter
    ) {
      return false;
    }

    if (
      branchFilter &&
      pos.merchant_branch_id !== branchFilter
    ) {
      return false;
    }

    return true;
  });
}, [
  posDevices,
  merchantFilter,
  branchFilter,
]);

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
        branchFilter &&
        transaction.merchant_branch_id_benefi !==
          branchFilter
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
          operationTypeFilter &&
          normalize(transaction.operation_type) !==
            operationTypeFilter
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
          pos?.merchant_reference,
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
    branchFilter,
    posFilter,
    statusFilter,
    operationTypeFilter,
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

      const newOperations =
        data.summary?.new_operations ?? 0;

      const changedOperations =
        data.summary?.changed_operations ?? 0;

      setLastSync(new Date());

      setMessage(
        `Sincronización completada. MENTA informó ${received} operaciones, ${synced} fueron actualizadas, ${newOperations} son nuevas, ${changedOperations} tenían cambios reales, ${Math.max(
          received - synced,
          0
        )} quedaron sin cambios, ${data.summary?.total_pages_menta ?? 0} páginas consultadas.`
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
    setBranchFilter("");
    setPosFilter("");
    setStatusFilter("");
    setPaymentFilter("");
    setOperationTypeFilter("");
    setSearch("");
  };

useEffect(() => {
  if (!posFilter) return;

  const selectedPos = posDevices.find(
    (pos) => pos.id === posFilter
  );

  if (!selectedPos) {
    setPosFilter("");
    return;
  }

  if (
    (merchantFilter &&
      selectedPos.merchant_id !== merchantFilter) ||
    (branchFilter &&
      selectedPos.merchant_branch_id !== branchFilter)
  ) {
    setPosFilter("");
  }
}, [
  merchantFilter,
  branchFilter,
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
              onChange={(event) => {
                setMerchantFilter(event.target.value);
                setBranchFilter("");
                setPosFilter("");
              }}
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

          <FilterField label="Sucursal">
            <select
              value={branchFilter}
              onChange={(event) => {
                setBranchFilter(
                  event.target.value
                );

                setPosFilter("");
              }}
              className={inputClass}
            >
              <option value="">
                Todas las sucursales
              </option>

              {branches
                .filter(
                  (branch) =>
                    !merchantFilter ||
                    branch.merchant_id ===
                      merchantFilter
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

          <FilterField label="Tipo de operación">
            <select
              value={operationTypeFilter}
              onChange={(event) =>
                setOperationTypeFilter(event.target.value)
              }
              className={inputClass}
            >
              <option value="">Todos</option>
              <option value="PAYMENT">Venta</option>
              <option value="ANNULMENT">
                Anulación
              </option>
              <option value="REFUND">
                Devolución
              </option>
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
              <option value="REVERSED">
                Reversadas
              </option>
              <option value="FAILED">
                Fallidas
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
                      Tipo
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

                    <th className="px-4 py-3 text-right">
                      Arancel comercio
                    </th>

                    <th className="px-4 py-3 text-right">
                      Adquirente
                    </th>

                    <th className="px-4 py-3 text-right">
                      MENTA
                    </th>

                    <th className="px-4 py-3 text-right">
                      Panda
                    </th>

                    <th className="px-4 py-3 text-right">
                      Rentabilidad BENEFÍ
                    </th>

                    <th className="px-4 py-3">
                      Estado
                    </th>

                    <th
                      className="px-4 py-3 text-center"
                      aria-label="Ver detalle"
                    />
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredTransactions.map(
                    (transaction) => (
                      <OperationRow
                        key={transaction.id}
                        transaction={transaction}
                        paymentCosts={paymentCosts}
                        onViewDetail={() =>
                          setSelectedTransaction(transaction)
                        }
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
      {selectedTransaction && (
      <div className="fixed inset-0 z-50">
        <button
          type="button"
          aria-label="Cerrar detalle"
          onClick={() =>
            setSelectedTransaction(null)
          }
          className="absolute inset-0 bg-slate-950/30"
        />

        <aside className="absolute right-0 top-0 h-full w-full max-w-[460px] overflow-y-auto bg-white shadow-2xl">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Detalle de operación
              </p>

              <h2 className="mt-1 text-lg font-bold text-slate-950">
                N°{" "}
                {selectedTransaction.operation_number ||
                  "-"}
              </h2>
            </div>

            <button
              type="button"
              onClick={() =>
                setSelectedTransaction(null)
              }
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
              aria-label="Cerrar detalle"
              title="Cerrar"
            >
              ×
            </button>
          </div>

          <div className="p-5">
            <div className="border-b border-slate-200 pb-5 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Estado
              </p>

              <div className="mt-2">
                <StatusBadge
                  status={selectedTransaction.status}
                />
              </div>

              <p className="mt-3 text-sm text-slate-500">
                {isApproved(selectedTransaction)
                  ? "Transacción aprobada"
                  : statusLabel(
                      selectedTransaction.status
                    )}
              </p>
            </div>
            <div className="py-5">
              <h3 className="mb-4 text-sm font-semibold text-slate-950">
                Datos de la operación
              </h3>

              <div className="space-y-3">
                <DetailRow
                  label="Fecha / hora"
                  value={formatDateTime(
                    selectedTransaction.transaction_datetime
                  )}
                />

                <DetailRow
                  label="RRN"
                  value={
                    getOperationDetailValue(
                      selectedTransaction.operation_detail,
                      "rrn"
                    ) || "-"
                  }
                />

                <DetailRow
                  label="Autorización"
                  value={
                    getOperationDetailValue(
                      selectedTransaction.operation_detail,
                      "authorization_code"
                    ) || "-"
                  }
                />

                <DetailRow
                  label="N° de operación"
                  value={
                    selectedTransaction.operation_number ||
                    "-"
                  }
                />

                <DetailRow
                  label="Comercio"
                  value={
                    selectedTransaction.merchant_id_benefi
                      ? merchantMap.get(
                          selectedTransaction.merchant_id_benefi
                        )?.name || "Sin vincular"
                      : "Sin vincular"
                  }
                />

                <DetailRow
                  label="POS / Terminal"
                  value={
                    selectedTransaction.pos_id
                      ? getPosDisplay(
                          posMap.get(
                            selectedTransaction.pos_id
                          ) || null
                        )
                      : selectedTransaction.serial_number
                      ? selectedTransaction.serial_number
                      : "-"
                  }
                />

                <DetailRow
                  label="Adquirente"
                  value={
                    selectedTransaction.acquirer ||
                    "-"
                  }
                />

                <DetailRow
                  label="Tipo"
                  value={operationLabel(
                    selectedTransaction
                  )}
                />

                </div>

                  <div className="mt-5 border-t border-slate-200 pt-5">
                    <h3 className="mb-4 text-sm font-semibold text-slate-950">
                      Datos del pago
                    </h3>

                    <div className="space-y-3">
                      
                </div>

                <DetailRow
                  label="Medio de pago"
                  value={paymentMethodLabel(
                    selectedTransaction.payment_method
                  )}
                />

                <DetailRow
                  label="Marca"
                  value={
                    getCardBrand(
                      selectedTransaction.operation_detail
                    ) || "-"
                  }
                />

                <DetailRow
                  label="Titular"
                  value={
                    getOperationDetailValue(
                      selectedTransaction.operation_detail,
                      "holder_name"
                    ) || "-"
                  }
                />

                <DetailRow
                  label="Tarjeta"
                  value={
                    getCardDetailValue(
                      selectedTransaction.operation_detail,
                      "card_mask"
                    ) || "-"
                  }
                />

                <DetailRow
                  label="BIN"
                  value={
                    getCardDetailValue(
                      selectedTransaction.operation_detail,
                      "card_bin"
                    ) || "-"
                  }
                />

                <DetailRow
                  label="Cuotas"
                  value={
                    selectedTransaction.installments
                      ? String(
                          selectedTransaction.installments
                        )
                      : "-"
                  }
                />

                <DetailRow
                  label="Importe"
                  value={formatMoney(
                    Number(
                      selectedTransaction.gross_amount ||
                        0
                    ),
                    selectedTransaction.currency ||
                      "ARS"
                  )}
                  strong
                />

                <DetailRow
                  label="Fecha de acreditación"
                  value={formatDate(
                    selectedTransaction.merchant_payment_date
                  )}
                />
              </div>
            </div>
          </div>
        </aside>
      </div>
    )}
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
  paymentCosts,
  onViewDetail,
}: {
  transaction: Transaction;
  merchant: Merchant | null;
  branch: MerchantBranch | null;
  pos: PosDevice | null;
  paymentCosts: PaymentCostSetting[];
  onViewDetail: () => void;
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
          {getPosDisplay(pos)}
        </p>

        <p className="mt-0.5 text-xs text-slate-400">
          {pos?.code || "Sin código"}
        </p>
      </td>

      <td className="px-4 py-3">
        <p className="font-medium text-slate-800">
          N° {transaction.operation_number || "-"}
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
      </td>

      <td className="px-4 py-3">
        <p className="text-slate-700">
          {paymentMethodLabel(
            transaction.payment_method
          )}
        </p>

        {getCardBrand(transaction.operation_detail) && (
          <p className="mt-0.5 text-xs text-slate-500">
            {getCardBrand(transaction.operation_detail)}
          </p>
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

      {/* Arancel comercio */}
      <td className="whitespace-nowrap px-4 py-3 text-right">
        {(() => {
          const economics = getOperationEconomics(
            transaction,
            paymentCosts
          );

          if (!economics) {
            return (
              <span className="text-slate-400">
                —
              </span>
            );
          }

          return (
            <>
              <p className="font-semibold text-slate-800">
                {formatMoney(
                  economics.merchantFee,
                  transaction.currency || "ARS"
                )}
              </p>

              <p className="mt-0.5 text-xs text-slate-500">
                {economics.merchantRate.toFixed(2)}%
              </p>
            </>
          );
        })()}
      </td>

      {/* Adquirente */}
      <td className="whitespace-nowrap px-4 py-3 text-right">
        {(() => {
          const economics = getOperationEconomics(
            transaction,
            paymentCosts
          );

          if (!economics) {
            return (
              <span className="text-slate-400">
                —
              </span>
            );
          }

          return (
            <>
              <p className="font-semibold text-slate-800">
                {formatMoney(
                  economics.acquirerCost,
                  transaction.currency || "ARS"
                )}
              </p>

              <p className="mt-0.5 text-xs text-slate-500">
                {economics.acquirerRate.toFixed(2)}%
              </p>
            </>
          );
        })()}
      </td>

            {/* MENTA */}
            <td className="whitespace-nowrap px-4 py-3 text-right">
              {(() => {
                const economics = getOperationEconomics(
                  transaction,
                  paymentCosts
                );

                if (!economics) {
                  return (
                    <span className="text-slate-400">
                      —
                    </span>
                  );
                }

                return (
                  <>
                    <p className="font-semibold text-slate-800">
                      {formatMoney(
                        economics.mentaCost,
                        transaction.currency || "ARS"
                      )}
                    </p>

                    <p className="mt-0.5 text-xs text-slate-500">
                      {economics.mentaRate.toFixed(2)}%
                    </p>
                  </>
                );
              })()}
            </td>
            {/* Panda */}
      <td className="whitespace-nowrap px-4 py-3 text-right">
        {(() => {
          const economics = getOperationEconomics(
            transaction,
            paymentCosts
          );

          if (!economics) {
            return (
              <span className="text-slate-400">
                —
              </span>
            );
          }

          return (
            <>
              <p className="font-semibold text-slate-800">
                {formatMoney(
                  economics.pandaCost,
                  transaction.currency || "ARS"
                )}
              </p>

              <p className="mt-0.5 text-xs text-slate-500">
                {economics.pandaRate.toFixed(2)}%
              </p>
            </>
          );
        })()}
      </td>

      {/* Rentabilidad BENEFÍ */}
      <td className="whitespace-nowrap px-4 py-3 text-right">
        {(() => {
          const economics = getOperationEconomics(
            transaction,
            paymentCosts
          );

          if (!economics) {
            return (
              <span className="text-slate-400">
                —
              </span>
            );
          }

          const benefiRate =
            economics.merchantRate -
            economics.acquirerRate -
            economics.mentaRate -
            economics.pandaRate;

          return (
            <>
              <p className="font-semibold text-emerald-700">
                {formatMoney(
                  economics.benefiProfit,
                  transaction.currency || "ARS"
                )}
              </p>

              <p className="mt-0.5 text-xs text-slate-500">
                {benefiRate.toFixed(2)}%
              </p>
            </>
          );
        })()}
      </td>

      <td className="px-4 py-3">
        <StatusBadge status={transaction.status} />
      </td>
      <td className="px-4 py-3 text-center">
        <button
          type="button"
          onClick={onViewDetail}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
          title="Ver detalle de operación"
          aria-label="Ver detalle de operación"
        >
          <Search size={18} />
        </button>
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
              {getPosDisplay(pos)}
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
          value={
            getCardBrand(transaction.operation_detail)
              ? `${paymentMethodLabel(
                  transaction.payment_method
                )} · ${getCardBrand(
                  transaction.operation_detail
                )}`
              : paymentMethodLabel(
                  transaction.payment_method
                )
          }
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

function DetailRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-5">
      <span className="text-sm text-slate-500">
        {label}
      </span>

      <span
        className={`text-right text-sm ${
          strong
            ? "font-bold text-slate-950"
            : "font-medium text-slate-800"
        }`}
      >
        {value}
      </span>
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

  if (normalized === "REVERSED") {
    return (
      <span className="inline-flex whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
        Reversada
      </span>
    );
  }

  if (normalized === "FAILED") {
    return (
      <span className="inline-flex whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
        Fallida
      </span>
    );
  }

  return (
    <span className="inline-flex whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
      {statusLabel(status)}
    </span>
  );
}