"use client";

import * as XLSX from "xlsx-js-style";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

type ClosureTransaction = {
  id: string;
  pos_id: string | null;
  transaction_id: string | null;
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
  financing: unknown;
  acquirer: unknown;
  operation_detail: {
    holder_name?: string | null;
    card?: {
      card_brand?: string | null;
      card_mask?: string | null;
      card_bin?: string | null;
      is_international_card?: boolean | null;
    } | null;
  } | null;
};

type PosDevice = {
  id: string;
  code: string | null;
  serial: string | null;
  merchant_reference: string | null;
  merchant_id: string | null;
  merchant_branch_id: string | null;
};

type Merchant = {
  id: string;
  name: string | null;
};

export default function CierreTurnoPage() {
  const [posDevices, setPosDevices] =
    useState<PosDevice[]>([]);

const [merchants, setMerchants] =
  useState<Merchant[]>([]);

  const [selectedPosIds, setSelectedPosIds] =
    useState<string[]>([]);

  const [loadingPos, setLoadingPos] =
    useState(true);

  const [error, setError] =
    useState("");

const [dateFrom, setDateFrom] =
  useState("");

const [timeFrom, setTimeFrom] =
  useState("");

const [dateTo, setDateTo] =
  useState("");

const [timeTo, setTimeTo] =
  useState("");

const [generating, setGenerating] =
  useState(false);

const [transactions, setTransactions] =
  useState<ClosureTransaction[]>([]);

const [generateError, setGenerateError] =
  useState("");

const [showDetail, setShowDetail] =
  useState(false);

const selectedMerchantIds = Array.from(
  new Set(
    posDevices
      .filter((pos) =>
        selectedPosIds.includes(pos.id)
      )
      .map((pos) => pos.merchant_id)
      .filter(
        (id): id is string =>
          Boolean(id)
      )
  )
);

const selectedMerchantNames =
  selectedMerchantIds
    .map(
      (merchantId) =>
        merchants.find(
          (merchant) =>
            merchant.id === merchantId
        )?.name
    )
    .filter(
      (name): name is string =>
        Boolean(name)
    );

const closureMerchantName =
  selectedMerchantNames.length > 0
    ? selectedMerchantNames.join(" / ")
    : "BENEFÍ";

  useEffect(() => {
    async function loadPos() {
      try {
        setLoadingPos(true);
        setError("");

        const response = await fetch(
          "/api/portal-comercio/cierre-turno"
        );

        const data = await response.json();

        if (!response.ok || !data.ok) {
          throw new Error(
            data.error ||
              "No se pudieron cargar los POS."
          );
        }

        setPosDevices(
          data.posDevices || []
        );
        setMerchants(data.merchants || []);

      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar los POS."
        );
      } finally {
        setLoadingPos(false);
      }
    }

    loadPos();
  }, []);

  const allSelected = useMemo(() => {
    return (
      posDevices.length > 0 &&
      selectedPosIds.length ===
        posDevices.length
    );
  }, [posDevices, selectedPosIds]);

  function togglePos(posId: string) {
    setSelectedPosIds((current) =>
      current.includes(posId)
        ? current.filter(
            (id) => id !== posId
          )
        : [...current, posId]
    );
  }

  function toggleAllPos() {
    if (allSelected) {
      setSelectedPosIds([]);
      return;
    }

    setSelectedPosIds(
      posDevices.map((pos) => pos.id)
    );
  }

  async function generateClosure() {
  try {
    setGenerating(true);
    setGenerateError("");
    setTransactions([]);
    setShowDetail(false);

    const response = await fetch(
      "/api/portal-comercio/cierre-turno",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          posIds: selectedPosIds,
          dateFrom,
          timeFrom,
          dateTo,
          timeTo,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error ||
          "No se pudo generar el cierre."
      );
    }

    setTransactions(
      data.transactions || []
    );
  } catch (closureError) {
    setGenerateError(
      closureError instanceof Error
        ? closureError.message
        : "No se pudo generar el cierre."
    );
  } finally {
    setGenerating(false);
  }
}

function normalizeBrand(
  value: string | null | undefined
) {
  return (value || "")
    .trim()
    .toUpperCase();
}

function getSummaryCategory(
  transaction: ClosureTransaction
) {
  const method = (
    transaction.payment_method || ""
  ).toUpperCase();

  const brand = normalizeBrand(
    transaction.operation_detail?.card
      ?.card_brand
  );

  if (method === "QR") {
    return "qr";
  }

  if (brand.includes("NARANJA")) {
    return "naranja";
  }

  if (brand.includes("CABAL")) {
    if (method === "DEBIT") {
      return "cabalDebit";
    }

    return "cabalCredit";
  }

  if (
    brand.includes("MAESTRO")
  ) {
    return "maestro";
  }

  if (
    brand.includes("MASTERCARD") ||
    brand.includes("MASTER")
  ) {
    if (method === "DEBIT") {
      return "mcDebit";
    }

    if (method === "PREPAID") {
      return "mcPrepaid";
    }

    return "mcCredit";
  }

  if (brand.includes("VISA")) {
    if (method === "DEBIT") {
      return "visaDebit";
    }

    if (method === "PREPAID") {
      return "visaPrepaid";
    }

    return "visaCredit";
  }

  return "other";
}

const closureSummary = posDevices
  .filter((pos) =>
    selectedPosIds.includes(pos.id)
  )
  .map((pos) => {
    const totals = {
      visaCredit: 0,
      naranja: 0,
      visaDebit: 0,
      visaPrepaid: 0,
      cabalCredit: 0,
      cabalDebit: 0,
      mcCredit: 0,
      mcPrepaid: 0,
      maestro: 0,
      mcDebit: 0,
      qr: 0,
      other: 0,
      total: 0,
    };

    const approvedTransactions =
      transactions.filter(
        (transaction) =>
          transaction.pos_id === pos.id &&
          transaction.status === "APPROVED"
      );

    const rejectedTransactions =
      transactions.filter(
        (transaction) =>
          transaction.pos_id === pos.id &&
          transaction.status === "REJECTED"
      );

    for (const transaction of approvedTransactions) {
      const amount = Number(
        transaction.gross_amount || 0
      );

      const category =
        getSummaryCategory(transaction);

      totals[category] += amount;
      totals.total += amount;
    }

    return {
        pos,
        operationCount:
            approvedTransactions.length +
            rejectedTransactions.length,
        approvedCount:
            approvedTransactions.length,
        rejectedCount:
            rejectedTransactions.length,
        ...totals,
        };
  });

function exportClosureExcel() {
  const workbook = XLSX.utils.book_new();

    const generatedAt = new Date();

  const generatedAtText =
    generatedAt.toLocaleString(
      "es-AR",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone:
          "America/Argentina/Buenos_Aires",
      }
    );

  const summaryRows: (string | number)[][] = [
    [`CIERRE DE TURNO - ${closureMerchantName}`],
        [
        "Fecha desde",
        dateFrom,
        "Hora desde",
        timeFrom,
        "Fecha hasta",
        dateTo,
        "Hora hasta",
        timeTo,
        ],
        [
        "POS incluidos",
        closureSummary
            .map(
            (row) =>
                `${row.pos.merchant_reference ||
                row.pos.code ||
                "POS"}${
                row.pos.serial
                    ? ` / ${row.pos.serial.slice(-5)}`
                    : ""
                }`
            )
            .join(" - "),
        ],
        [
        "Generado",
        generatedAtText,
        ],
        [""],
    [
      "POS",
        "OPERACIONES",
        "APROBADAS",
        "RECHAZADAS",
        "VISA CRÉDITO",
      "NARANJA",
      "VISA DÉBITO",
      "VISA PREPAGO",
      "CABAL CRÉDITO",
      "CABAL DÉBITO",
      "MC CRÉDITO",
      "MC PREPAGO",
      "MAESTRO",
      "MC DÉBITO",
      "QR",
      "OTROS",
      "TOTAL",
    ],
  ];

  for (const row of closureSummary) {
  summaryRows.push([
    `${row.pos.merchant_reference || row.pos.code || "POS"}${
      row.pos.serial
        ? ` / ${row.pos.serial.slice(-5)}`
        : ""
    }`,
    row.operationCount,
    row.approvedCount,
    row.rejectedCount,
    row.visaCredit,
    row.naranja,
    row.visaDebit,
    row.visaPrepaid,
    row.cabalCredit,
    row.cabalDebit,
    row.mcCredit,
    row.mcPrepaid,
    row.maestro,
    row.mcDebit,
    row.qr,
    row.other,
    row.total,
  ]);
}

  const totalApproved = closureSummary.reduce(
    (sum, row) => sum + row.approvedCount,
    0
    );

    const totalRejected = closureSummary.reduce(
    (sum, row) => sum + row.rejectedCount,
    0
    );

    const totalOperations = closureSummary.reduce(
    (sum, row) => sum + row.operationCount,
    0
    );

  const totalKeys = [
    "visaCredit",
    "naranja",
    "visaDebit",
    "visaPrepaid",
    "cabalCredit",
    "cabalDebit",
    "mcCredit",
    "mcPrepaid",
    "maestro",
    "mcDebit",
    "qr",
    "other",
    "total",
  ] as const;

summaryRows.push([
  "TOTAL TURNO",
  totalOperations,
  totalApproved,
  totalRejected,
  ...totalKeys.map((key) =>
    closureSummary.reduce(
      (sum, row) =>
        sum + Number(row[key] || 0),
      0
    )
  ),
]);

  const summarySheet =
    XLSX.utils.aoa_to_sheet(summaryRows);
    // Título
if (summarySheet["A1"]) {
  summarySheet["A1"].s = {
    font: {
      bold: true,
      sz: 14,
    },
  };
}

// Encabezados del resumen
for (let column = 0; column <= 16; column++) {
  const cellAddress =
    XLSX.utils.encode_cell({
      r: 5,
      c: column,
    });

  if (summarySheet[cellAddress]) {
    summarySheet[cellAddress].s = {
        font: {
        bold: true,
        },
        fill: {
        patternType: "solid",
        fgColor: {
            rgb: "E2E8F0",
        },
        },
        border: {
        bottom: {
            style: "thin",
            color: {
            rgb: "94A3B8",
            },
        },
        },
    };
    }
}

// TOTAL TURNO
const totalRowNumber =
  7 + closureSummary.length;

for (let column = 0; column <= 16; column++) {
  const cellAddress =
    XLSX.utils.encode_cell({
      r: totalRowNumber - 1,
      c: column,
    });

  if (summarySheet[cellAddress]) {
    summarySheet[cellAddress].s = {
      font: {
        bold: true,
      },
      fill: {
        patternType: "solid",
        fgColor: {
          rgb: "F1F5F9",
        },
      },
      border: {
        top: {
          style: "medium",
          color: {
            rgb: "64748B",
          },
        },
      },
    };
  }
}

summarySheet["!cols"] = [
  { wch: 22 }, // POS
  { wch: 14 }, // OPERACIONES
  { wch: 14 }, // APROBADAS
  { wch: 14 }, // RECHAZADAS
  { wch: 16 }, // VISA CRÉDITO
  { wch: 14 }, // NARANJA
  { wch: 16 }, // VISA DÉBITO
  { wch: 16 }, // VISA PREPAGO
  { wch: 16 }, // CABAL CRÉDITO
  { wch: 16 }, // CABAL DÉBITO
  { wch: 16 }, // MC CRÉDITO
  { wch: 16 }, // MC PREPAGO
  { wch: 14 }, // MAESTRO
  { wch: 16 }, // MC DÉBITO
  { wch: 16 }, // QR
  { wch: 16 }, // OTROS
  { wch: 18 }, // TOTAL
];

const firstDataRow = 7;
const lastDataRow =
  firstDataRow + closureSummary.length;

for (
  let row = firstDataRow;
  row <= lastDataRow;
  row++
) {
  for (
    let column = 4;
    column <= 16;
    column++
  ) {
    const cellAddress =
      XLSX.utils.encode_cell({
        r: row - 1,
        c: column,
      });

    if (summarySheet[cellAddress]) {
      summarySheet[cellAddress].z =
        '$ #,##0.00';
    }
  }
}

XLSX.utils.book_append_sheet(
  workbook,
  summarySheet,
  "Resumen del cierre"
);

  const detailRows = transactions.map(
    (transaction) => ({
      Hora: transaction.transaction_datetime
        ? new Date(
            transaction.transaction_datetime
            ).toLocaleTimeString(
            "es-AR",
            {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
                timeZone:
                "America/Argentina/Buenos_Aires",
            }
            )
        : "-",
      POS:
        posDevices.find(
          (pos) =>
            pos.id === transaction.pos_id
        )?.merchant_reference ||
        transaction.pos_id,
      Operación:
        transaction.operation_number,
      Tipo:
        transaction.operation_type,
      Marca:
        transaction.operation_detail?.card
          ?.card_brand || "-",
      "Medio de pago":
        transaction.payment_method,
      Cuotas:
        transaction.installments || "-",
      Importe: Number(
        transaction.gross_amount || 0
      ),
      Estado:
        transaction.status === "APPROVED"
          ? "Aprobada"
          : transaction.status,
    })
  );

  const detailSheet =
    XLSX.utils.json_to_sheet(detailRows);
    for (let column = 0; column <= 8; column++) {
  const cellAddress =
    XLSX.utils.encode_cell({
      r: 0,
      c: column,
    });

  if (detailSheet[cellAddress]) {
    detailSheet[cellAddress].s = {
      font: {
        bold: true,
      },
    };
  }
}

  detailSheet["!cols"] = [
    { wch: 14 },
    { wch: 20 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 10 },
    { wch: 18 },
    { wch: 14 },
  ];

  for (
    let row = 2;
    row <= detailRows.length + 1;
    row++
  ) {
    const cell = detailSheet[`H${row}`];

    if (cell) {
      cell.z = '$ #,##0.00';
    }
  }

  XLSX.utils.book_append_sheet(
    workbook,
    detailSheet,
    "Detalle"
  );

  XLSX.writeFile(
    workbook,
    `Cierre_Turno_${dateFrom}_${timeFrom.replace(
      ":",
      "-"
    )}_${dateTo}_${timeTo.replace(
      ":",
      "-"
    )}.xlsx`
  );
}

  return (
    <main className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">
          Cierre de turno
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Consultá y controlá las operaciones
          realizadas durante un turno.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold text-slate-900">
          Datos del turno
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Seleccioná los POS y el período que
          querés controlar.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                Fecha desde
                </label>

                <input
                type="date"
                value={dateFrom}
                onChange={(event) =>
                    setDateFrom(event.target.value)
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
            </div>

            <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                Hora desde
                </label>

                <input
                type="time"
                value={timeFrom}
                onChange={(event) =>
                    setTimeFrom(event.target.value)
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
            </div>

            <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                Fecha hasta
                </label>

                <input
                type="date"
                value={dateTo}
                onChange={(event) =>
                    setDateTo(event.target.value)
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
            </div>

            <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                Hora hasta
                </label>

                <input
                type="time"
                value={timeTo}
                onChange={(event) =>
                    setTimeTo(event.target.value)
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
            </div>
            </div>

        <div className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-700">
              POS
            </p>

            {posDevices.length > 0 && (
              <button
                type="button"
                onClick={toggleAllPos}
                className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
              >
                {allSelected
                  ? "Deseleccionar todos"
                  : "Seleccionar todos"}
              </button>
            )}
          </div>

          {loadingPos && (
            <p className="mt-2 text-sm text-slate-500">
              Cargando equipos...
            </p>
          )}

          {!loadingPos &&
            posDevices.length === 0 &&
            !error && (
              <p className="mt-2 text-sm text-slate-500">
                No hay POS disponibles.
              </p>
            )}

          {error && (
            <p className="mt-2 text-sm text-red-600">
              {error}
            </p>
          )}

          {!loadingPos &&
            posDevices.length > 0 && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {posDevices.map((pos) => {
                  const checked =
                    selectedPosIds.includes(
                      pos.id
                    );

                  return (
                    <label
                      key={pos.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                        checked
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          togglePos(pos.id)
                        }
                        className="h-4 w-4"
                      />

                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          {pos.merchant_reference ||
                            pos.code ||
                            "POS"}
                        </p>

                        <p className="truncate text-xs text-slate-500">
                          Serie:{" "}
                          {pos.serial || "-"}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
        </div>

        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            {selectedPosIds.length} POS
            seleccionados
          </p>

          <button
            type="button"
            onClick={generateClosure}
            disabled={
                selectedPosIds.length === 0 ||
                !dateFrom ||
                !timeFrom ||
                !dateTo ||
                !timeTo ||
                generating
            }
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
            {generating
                ? "Generando..."
                : "Generar cierre"}
            </button>
        </div>
      </section>
      {generateError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {generateError}
        </div>
        )}

        {transactions.length > 0 &&
            !showDetail && (
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                    <div>
                    <h2 className="text-base font-semibold text-slate-900">
                        Resumen del cierre
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                        {dateFrom} {timeFrom} —{" "}
                        {dateTo} {timeTo}
                    </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() =>
                        setShowDetail(true)
                        }
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                        Ver detalle
                    </button>

                    <button
                    type="button"
                    onClick={exportClosureExcel}
                    disabled={transactions.length === 0}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                    Exportar Excel
                    </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-[1500px] divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                            POS
                            </th>

                            <th className="px-3 py-3 text-center text-xs font-semibold uppercase text-slate-500">
                            Operaciones
                            </th>

                            <th className="px-3 py-3 text-center text-xs font-semibold uppercase text-slate-500">
                            Aprobadas
                            </th>

                            <th className="px-3 py-3 text-center text-xs font-semibold uppercase text-slate-500">
                            Rechazadas
                            </th>

                            <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                            Visa Crédito
                            </th>

                            <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                            Naranja
                            </th>

                            <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                            Visa Débito
                            </th>

                            <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                            Visa Prepago
                            </th>

                            <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                            Cabal Crédito
                            </th>

                            <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                            Cabal Débito
                            </th>

                            <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                            MC Crédito
                            </th>

                            <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                            MC Prepago
                            </th>

                            <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                            Maestro
                            </th>

                            <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                            MC Débito
                            </th>

                            <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                            QR
                            </th>

                            <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                            Otros
                            </th>

                            <th className="px-3 py-3 text-right text-xs font-bold uppercase text-slate-700">
                            Total
                            </th>
                        </tr>
                        </thead>

                    <tbody className="divide-y divide-slate-100 bg-white">
                        {closureSummary.map(
                        (row) => {
                            const formatAmount = (
                            value: number
                            ) =>
                            value === 0
                                ? "-"
                                : value.toLocaleString(
                                    "es-AR",
                                    {
                                    style:
                                        "currency",
                                    currency:
                                        "ARS",
                                    }
                                );

                            return (
                            <tr key={row.pos.id}>
                                <td className="whitespace-nowrap px-3 py-3">
                                <p className="text-sm font-semibold text-slate-900">
                                    {row.pos
                                    .merchant_reference ||
                                    row.pos.code ||
                                    "POS"}
                                </p>

                                <p className="text-xs text-slate-500">
                                    {row.pos.serial
                                    ? row.pos.serial.slice(
                                        -5
                                        )
                                    : "-"}
                                </p>
                                </td>

                                <td className="whitespace-nowrap px-3 py-3 text-center text-sm font-semibold text-slate-900">
                                {row.operationCount}
                                </td>

                                <td className="whitespace-nowrap px-3 py-3 text-center text-sm font-semibold text-slate-900">
                                {row.approvedCount}
                                </td>

                                <td className="whitespace-nowrap px-3 py-3 text-center text-sm font-semibold text-slate-900">
                                {row.rejectedCount}
                                </td>

                                <td className="whitespace-nowrap px-3 py-3 text-right text-sm">
                                {formatAmount(
                                    row.visaCredit
                                )}
                                </td>

                                <td className="whitespace-nowrap px-3 py-3 text-right text-sm">
                                {formatAmount(
                                    row.naranja
                                )}
                                </td>

                                <td className="whitespace-nowrap px-3 py-3 text-right text-sm">
                                {formatAmount(
                                    row.visaDebit
                                )}
                                </td>

                                <td className="whitespace-nowrap px-3 py-3 text-right text-sm">
                                {formatAmount(
                                    row.visaPrepaid
                                )}
                                </td>

                                <td className="whitespace-nowrap px-3 py-3 text-right text-sm">
                                {formatAmount(
                                    row.cabalCredit
                                )}
                                </td>

                                <td className="whitespace-nowrap px-3 py-3 text-right text-sm">
                                {formatAmount(
                                    row.cabalDebit
                                )}
                                </td>

                                <td className="whitespace-nowrap px-3 py-3 text-right text-sm">
                                {formatAmount(
                                    row.mcCredit
                                )}
                                </td>

                                <td className="whitespace-nowrap px-3 py-3 text-right text-sm">
                                {formatAmount(
                                    row.mcPrepaid
                                )}
                                </td>

                                <td className="whitespace-nowrap px-3 py-3 text-right text-sm">
                                {formatAmount(
                                    row.maestro
                                )}
                                </td>

                                <td className="whitespace-nowrap px-3 py-3 text-right text-sm">
                                {formatAmount(
                                    row.mcDebit
                                )}
                                </td>

                                <td className="whitespace-nowrap px-3 py-3 text-right text-sm">
                                {formatAmount(
                                    row.qr
                                )}
                                </td>

                                <td className="whitespace-nowrap px-3 py-3 text-right text-sm">
                                {formatAmount(
                                    row.other
                                )}
                                </td>

                                <td className="whitespace-nowrap px-3 py-3 text-right text-sm font-bold text-slate-950">
                                {formatAmount(
                                    row.total
                                )}
                                </td>
                            </tr>
                            );
                        }
                        )}
                        <tr className="border-t-2 border-slate-300 bg-slate-50">
                            <td className="whitespace-nowrap px-3 py-3 text-sm font-bold text-slate-950">
                                TOTAL TURNO
                            </td>

                            <td className="whitespace-nowrap px-3 py-3 text-center text-sm font-bold text-slate-950">
                                {closureSummary.reduce(
                                (sum, row) =>
                                    sum + row.operationCount,
                                0
                                )}
                            </td>

                            <td className="whitespace-nowrap px-3 py-3 text-center text-sm font-bold text-slate-950">
                            {closureSummary.reduce(
                                (sum, row) =>
                                sum + row.approvedCount,
                                0
                            )}
                            </td>

                            <td className="whitespace-nowrap px-3 py-3 text-center text-sm font-bold text-slate-950">
                            {closureSummary.reduce(
                                (sum, row) =>
                                sum + row.rejectedCount,
                                0
                            )}
                            </td>

                            {[
                                "visaCredit",
                                "naranja",
                                "visaDebit",
                                "visaPrepaid",
                                "cabalCredit",
                                "cabalDebit",
                                "mcCredit",
                                "mcPrepaid",
                                "maestro",
                                "mcDebit",
                                "qr",
                                "other",
                                "total",
                            ].map((key) => {
                                const total =
                                closureSummary.reduce(
                                    (sum, row) =>
                                    sum +
                                    Number(
                                        row[
                                        key as keyof typeof row
                                        ] || 0
                                    ),
                                    0
                                );

                                return (
                                <td
                                    key={key}
                                    className="whitespace-nowrap px-3 py-3 text-right text-sm font-bold text-slate-950"
                                >
                                    {total === 0
                                    ? "-"
                                    : total.toLocaleString(
                                        "es-AR",
                                        {
                                            style: "currency",
                                            currency: "ARS",
                                        }
                                        )}
                                </td>
                                );
                            })}
                            </tr>
                    </tbody>
                    </table>
                </div>
                </section>
            )}

        {transactions.length > 0 &&
        showDetail && (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div>
                    <h2 className="text-base font-semibold text-slate-900">
                    Detalle del cierre
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                    {transactions.length} operaciones encontradas
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => setShowDetail(false)}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                    Volver al resumen
                </button>
                </div>

                <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                        Hora
                        </th>

                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                        POS
                        </th>

                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                        Operación
                        </th>

                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                        Tipo
                        </th>

                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                        Marca
                        </th>

                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                        Medio
                        </th>

                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-slate-500">
                        Cuotas
                        </th>

                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                        Importe
                        </th>

                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                        Estado
                        </th>
                    </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 bg-white">
                    {transactions.map((transaction) => {
                        const pos = posDevices.find(
                        (item) =>
                            item.id === transaction.pos_id
                        );

                        const cardBrand =
                        transaction.operation_detail?.card
                            ?.card_brand || "-";

                        const date =
                        transaction.transaction_datetime
                            ? new Date(
                                transaction.transaction_datetime
                            )
                            : null;

                        const time = date
                        ? date.toLocaleTimeString(
                            "es-AR",
                            {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                                timeZone:
                                "America/Argentina/Buenos_Aires",
                            }
                            )
                        : "-";

                        const amount =
                        Number(
                            transaction.gross_amount || 0
                        );

                        const approved =
                        transaction.status === "APPROVED";

                        return (
                        <tr key={transaction.id}>
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                            {time}
                            </td>

                            <td className="whitespace-nowrap px-4 py-3">
                            <p className="text-sm font-medium text-slate-900">
                                {pos?.merchant_reference ||
                                pos?.code ||
                                "-"}
                            </p>

                            {pos?.serial && (
                                <p className="text-xs text-slate-500">
                                {pos.serial.slice(-5)}
                                </p>
                            )}
                            </td>

                            <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                            {transaction.operation_number ||
                                "-"}
                            </td>

                            <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                            {transaction.operation_type ||
                                "-"}
                            </td>

                            <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                            {cardBrand}
                            </td>

                            <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                            {transaction.payment_method ||
                                "-"}
                            </td>

                            <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-slate-700">
                            {transaction.installments ||
                                "-"}
                            </td>

                            <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-slate-900">
                            {amount.toLocaleString(
                                "es-AR",
                                {
                                style: "currency",
                                currency: "ARS",
                                }
                            )}
                            </td>

                            <td className="whitespace-nowrap px-4 py-3">
                            <span
                                className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                                approved
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-red-50 text-red-700"
                                }`}
                            >
                                {approved
                                ? "Aprobada"
                                : transaction.status ||
                                    "-"}
                            </span>
                            </td>
                        </tr>
                        );
                    })}
                    </tbody>
                </table>
                </div>
            </section>
            )}

        {!generating &&
        !generateError &&
        transactions.length === 0 &&
        selectedPosIds.length > 0 &&
        dateFrom &&
        timeFrom &&
        dateTo &&
        timeTo && (
            <p className="text-sm text-slate-500">
            Completá los datos y presioná Generar
            cierre para consultar las operaciones.
            </p>
        )}
    </main>
  );
}