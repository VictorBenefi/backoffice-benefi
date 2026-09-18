"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useSearchParams } from "next/navigation";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Transaction = {
  id: string;
  pos_id: string | null;
  operation_number: string | null;
  operation_type: string | null;
  transaction_datetime: string;
  payment_method: string | null;
  installments: number | null;
  gross_amount: number | string | null;
  merchant_net_amount: number | string | null;

  operation_detail?: {
  card?: {
    card_brand?: string | null;
    is_international_card?: boolean | null;
  } | null;
} | null;
};

type Liquidation = {
  merchant_id: string;
  merchant_name: string;

  merchant_cuit: string | null;
  merchant_address: string | null;
  merchant_street: string | null;
  merchant_street_number: string | null;
  merchant_floor: string | null;
  merchant_apartment: string | null;
  merchant_postal_code: string | null;
  merchant_city: string | null;
  merchant_province: string | null;

  payment_date: string;
  operation_count: number;
  pos_count: number;

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
};

type PosDevice = {
  id: string;
  code: string;
  serial: string | null;
  merchant_reference: string | null;
};

type TaxBreakdownItem = {
  tax_code: string;
  label: string;
  amount: number;
};

function toNumber(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function formatMoney(value: unknown) {
  return new Intl.NumberFormat(
    "es-AR",
    {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 2,
    }
  ).format(toNumber(value));
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  const [year, month, day] =
    value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

export default function PortalComercioLiquidacionDetallePage() {
  const searchParams = useSearchParams();

  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState("");

  const [liquidation, setLiquidation] =
    useState<Liquidation | null>(null);

  const [transactions, setTransactions] =
    useState<Transaction[]>([]);

  const [posDevices, setPosDevices] =
    useState<PosDevice[]>([]);
  
  const [posFilter, setPosFilter] =
  useState("");

const [
  paymentMethodFilter,
  setPaymentMethodFilter,
] = useState("");

const [
  operationSearch,
  setOperationSearch,
] = useState("");

  const [
  taxBreakdown,
  setTaxBreakdown,
] = useState<TaxBreakdownItem[]>([]);

  useEffect(() => {
    async function loadDetail() {
      try {
        setLoading(true);
        setMessage("");

        const merchantId =
          searchParams.get(
            "merchant_id"
          );

        const paymentDate =
          searchParams.get(
            "payment_date"
          );

        if (
          !merchantId ||
          !paymentDate
        ) {
          throw new Error(
            "Faltan datos para consultar la liquidación."
          );
        }

        const params =
          new URLSearchParams({
            merchant_id:
              merchantId,
            payment_date:
              paymentDate,
          });

        const response =
          await fetch(
            `/api/portal-comercio/liquidaciones/detalle?${params.toString()}`,
            {
              cache: "no-store",
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.ok
        ) {
          throw new Error(
            data.error ||
              "No se pudo cargar la liquidación."
          );
        }

        setLiquidation(
          data.liquidation
        );

        setTransactions(
          data.transactions || []
        );

        setPosDevices(
          data.posDevices || []
        );

        setTaxBreakdown(
          data.taxBreakdown || []
        );

      } catch (error) {
        console.error(
          "Error cargando detalle:",
          error
        );

        setMessage(
          error instanceof Error
            ? error.message
            : "No se pudo cargar la liquidación."
        );
      } finally {
        setLoading(false);
      }
    }

    loadDetail();
  }, [searchParams]);

function getPosCode(
  posId: string | null
) {
  if (!posId) {
    return "Sin POS";
  }

  const pos =
    posDevices.find(
      (item) =>
        item.id === posId
    );

  if (!pos) {
    return "Sin POS";
  }

  const serialSuffix =
    pos.serial
      ? pos.serial.slice(-5)
      : null;

  if (
    pos.merchant_reference?.trim() &&
    serialSuffix
  ) {
    return `${pos.merchant_reference.trim()} / ${serialSuffix}`;
  }

  if (serialSuffix) {
    return serialSuffix;
  }

  return pos.code ||
    "Sin POS";
}

  function getCardBrand(
  transaction: Transaction
) {
  const card =
    transaction.operation_detail?.card;

  const brand = card?.card_brand;

  if (!brand) {
    return "-";
  }

  return card?.is_international_card
    ? `${brand} (Internacional)`
    : brand;
}

const filteredTransactions =
  useMemo(() => {
    const search =
      operationSearch
        .trim()
        .toLowerCase();

    return transactions.filter(
      (transaction) => {
        const matchesPos =
          !posFilter ||
          transaction.pos_id ===
            posFilter;

        const matchesPaymentMethod =
          !paymentMethodFilter ||
          transaction.payment_method ===
            paymentMethodFilter;

        const matchesOperation =
          !search ||
          (
            transaction.operation_number ||
            ""
          )
            .toLowerCase()
            .includes(search);

        return (
          matchesPos &&
          matchesPaymentMethod &&
          matchesOperation
        );
      }
    );
  }, [
    transactions,
    posFilter,
    paymentMethodFilter,
    operationSearch,
  ]);

  const totals = useMemo(() => {
    return transactions.reduce(
      (
        acc,
        transaction
      ) => {
        acc.gross +=
          toNumber(
            transaction.gross_amount
          );

        acc.net +=
          toNumber(
            transaction.merchant_net_amount
          );

        return acc;
      },
      {
        gross: 0,
        net: 0,
      }
    );
  }, [transactions]);

  const paymentMethodSummary =
  useMemo(() => {
    const groups = new Map<
      string,
      {
        paymentMethod: string;
        operations: number;
        grossAmount: number;
        netAmount: number;
      }
    >();

    transactions.forEach(
      (transaction) => {
        const paymentMethod =
          transaction.payment_method ||
          "OTRO";

        const current =
          groups.get(paymentMethod) || {
            paymentMethod,
            operations: 0,
            grossAmount: 0,
            netAmount: 0,
          };

        current.operations += 1;

        current.grossAmount +=
          toNumber(
            transaction.gross_amount
          );

        current.netAmount +=
          toNumber(
            transaction.merchant_net_amount
          );

        groups.set(
          paymentMethod,
          current
        );
      }
    );

    return Array.from(
      groups.values()
    ).sort(
      (a, b) =>
        b.netAmount - a.netAmount
    );
  }, [transactions]);

  const accreditationSummary =
  useMemo(() => {
    const groups = new Map<
      string,
      {
        payer: string;
        channel: string;
        operations: number;
        grossAmount: number;
        netAmount: number;
      }
    >();

    transactions.forEach(
      (transaction) => {
        const isQr =
          transaction.payment_method ===
          "QR";

        const payer = isQr
          ? "QRPCT"
          : "GRUPO PANDA";

        const channel = isQr
          ? "QR"
          : "TARJETAS";

        const key =
          `${payer}-${channel}`;

        const current =
          groups.get(key) || {
            payer,
            channel,
            operations: 0,
            grossAmount: 0,
            netAmount: 0,
          };

        current.operations += 1;

        current.grossAmount +=
          toNumber(
            transaction.gross_amount
          );

        current.netAmount +=
          toNumber(
            transaction.merchant_net_amount
          );

        groups.set(
          key,
          current
        );
      }
    );

    return Array.from(
      groups.values()
    );
  }, [transactions]);

  if (loading) {
    return (
      <div className="p-6 text-sm text-slate-500">
        Cargando detalle de liquidación...
      </div>
    );
  }

  if (
    message ||
    !liquidation
  ) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {message ||
            "No se encontró la liquidación."}
        </div>
      </div>
    );
  }
function exportExcel() {
  if (!liquidation) {
    return;
  }

  const workbook =
    XLSX.utils.book_new();

  const summaryRows = [
    ["DETALLE DE LIQUIDACIÓN", ""],
    ["", ""],

    [
      "Comercio",
      liquidation.merchant_name,
    ],
    [
      "Fecha de pago",
      formatDate(
        liquidation.payment_date
      ),
    ],
    [
      "Operaciones",
      liquidation.operation_count,
    ],

    ["", ""],
    ["DESGLOSE DE LIQUIDACIÓN", ""],

    [
      "Importe bruto",
      toNumber(
        liquidation.gross_amount
      ),
    ],

    ...taxBreakdown.map(
      (item) => [
        item.label,
        -Math.abs(
          toNumber(
            item.amount
          )
        ),
      ]
    ),

    [
      "Neto a acreditar",
      toNumber(
        liquidation.merchant_net_amount
      ),
    ],

    ["", ""],
    ["ACREDITACIONES", ""],

    [
      "Pagador",
      "Canal",
      "Operaciones",
      "Bruto",
      "Neto",
    ],

    ...accreditationSummary.map(
      (item) => [
        item.payer,
        item.channel,
        item.operations,
        item.grossAmount,
        item.netAmount,
      ]
    ),

    ["", ""],
    [
      "RESUMEN POR MEDIO DE PAGO",
      "",
    ],

    [
      "Medio",
      "Operaciones",
      "Bruto",
      "Neto",
    ],

    ...paymentMethodSummary.map(
      (item) => [
        item.paymentMethod,
        item.operations,
        item.grossAmount,
        item.netAmount,
      ]
    ),
  ];

  const summarySheet =
    XLSX.utils.aoa_to_sheet(
      summaryRows
    );

  summarySheet["!cols"] = [
    { wch: 24 },
    { wch: 22 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
  ];

  XLSX.utils.book_append_sheet(
    workbook,
    summarySheet,
    "Resumen"
  );

  const operationRows =
    transactions.map(
      (transaction) => ({
        "Fecha operación":
          new Intl.DateTimeFormat(
            "es-AR",
            {
              dateStyle: "short",
              timeStyle: "short",
            }
          ).format(
            new Date(
              transaction.transaction_datetime
            )
          ),

        POS: getPosCode(
          transaction.pos_id
        ),

        Operación:
          transaction.operation_number ||
          "",

        Tipo:
          transaction.operation_type ===
          "PAYMENT"
            ? "Venta"
            : transaction.operation_type ===
              "ANNULMENT"
            ? "Anulación"
            : transaction.operation_type ===
              "REFUND"
            ? "Devolución"
            : transaction.operation_type ||
              "",

        "Medio de pago":
          transaction.payment_method ||
          "",

        Marca:
          getCardBrand(
            transaction
          ),

        Cuotas:
          transaction.installments ||
          1,

        Bruto:
          toNumber(
            transaction.gross_amount
          ),

        Neto:
          toNumber(
            transaction.merchant_net_amount
          ),
      })
    );

  const operationsSheet =
    XLSX.utils.json_to_sheet(
      operationRows
    );

  operationsSheet["!cols"] = [
  { wch: 22 },
  { wch: 12 },
  { wch: 18 },
  { wch: 16 },
  { wch: 18 },
  { wch: 16 },
  { wch: 10 },
  { wch: 16 },
  { wch: 16 },
];

  XLSX.utils.book_append_sheet(
    workbook,
    operationsSheet,
    "Operaciones"
  );

  const merchantName =
    liquidation.merchant_name
      .replace(
        /[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+/g,
        "_"
      )
      .replace(/^_+|_+$/g, "");

  const paymentDate =
    liquidation.payment_date.replace(
      /-/g,
      ""
    );

  XLSX.writeFile(
    workbook,
    `Liquidacion_${merchantName}_${paymentDate}.xlsx`
  );
}

function exportPDF() {
  if (!liquidation) {
    return;
  }

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth =
    doc.internal.pageSize.getWidth();

  const pageHeight =
    doc.internal.pageSize.getHeight();

  const margin = 14;

  // =========================
  // DOMICILIO DEL COMERCIO
  // =========================

  const addressParts: string[] = [];

  if (liquidation.merchant_street) {
    let streetLine =
      liquidation.merchant_street;

    if (
      liquidation.merchant_street_number
    ) {
      streetLine += ` ${
        liquidation.merchant_street_number
      }`;
    }

    addressParts.push(streetLine);
  } else if (
    liquidation.merchant_address
  ) {
    addressParts.push(
      liquidation.merchant_address
    );
  }

  if (liquidation.merchant_floor) {
    addressParts.push(
      `Piso ${liquidation.merchant_floor}`
    );
  }

  if (
    liquidation.merchant_apartment
  ) {
    addressParts.push(
      `Dpto. ${
        liquidation.merchant_apartment
      }`
    );
  }

  const locationParts = [
    liquidation.merchant_city,
    liquidation.merchant_province,
  ].filter(Boolean);

  if (locationParts.length > 0) {
    addressParts.push(
      locationParts.join(", ")
    );
  }

  if (
    liquidation.merchant_postal_code
  ) {
    addressParts.push(
      `CP ${
        liquidation.merchant_postal_code
      }`
    );
  }

  const merchantAddress =
    addressParts.join(" · ") || "-";

  // =========================
  // ENCABEZADO
  // =========================

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("BENEFÍ", margin, 17);

  doc.setFontSize(15);
  doc.text(
    "LIQUIDACIÓN DE OPERACIONES",
    margin,
    27
  );

  doc.setFont(
    "helvetica",
    "normal"
  );

  doc.setFontSize(9);
  doc.setTextColor(90);

  doc.text(
    "Detalle de acreditación al comercio",
    margin,
    33
  );

  doc.setDrawColor(220);

  doc.line(
    margin,
    38,
    pageWidth - margin,
    38
  );

  doc.setTextColor(40);
  doc.setFontSize(9);

  // Comercio

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.text(
    "Comercio",
    margin,
    47
  );

  doc.setFont(
    "helvetica",
    "normal"
  );

  doc.text(
    liquidation.merchant_name,
    margin,
    52
  );

  // CUIT

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.text(
    "CUIT",
    margin,
    60
  );

  doc.setFont(
    "helvetica",
    "normal"
  );

  doc.text(
    liquidation.merchant_cuit ||
      "-",
    margin,
    65
  );

  // Domicilio

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.text(
    "Domicilio",
    margin,
    73
  );

  doc.setFont(
    "helvetica",
    "normal"
  );

  const addressLines =
    doc.splitTextToSize(
      merchantAddress,
      115
    );

  doc.text(
    addressLines,
    margin,
    78
  );

  // Fecha

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.text(
    "Fecha de pago",
    150,
    47
  );

  doc.setFont(
    "helvetica",
    "normal"
  );

  doc.text(
    formatDate(
      liquidation.payment_date
    ),
    150,
    52
  );

  // =========================
  // CONSOLIDADO
  // =========================

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(11);

  doc.text(
    "CONSOLIDADO",
    margin,
    92
  );

  autoTable(doc, {
    startY: 96,

    head: [[
      "Operaciones",
      "Importe bruto",
      "Neto a acreditar",
    ]],

    body: [[
      liquidation.operation_count,

      formatMoney(
        liquidation.gross_amount
      ),

      formatMoney(
        liquidation.merchant_net_amount
      ),
    ]],

    theme: "grid",

    styles: {
      fontSize: 9,
      cellPadding: 3,
    },

    headStyles: {
      fillColor: [
        30,
        58,
        95,
      ],

      textColor: [
        255,
        255,
        255,
      ],

      fontStyle: "bold",
    },

    bodyStyles: {
      fontStyle: "bold",
    },

    columnStyles: {
      0: {
        halign: "center",
      },

      1: {
        halign: "right",
      },

      2: {
        halign: "right",
      },
    },

    margin: {
      left: margin,
      right: margin,
    },
  });

  let currentY =
    (doc as any)
      .lastAutoTable
      .finalY + 10;

  // =========================
// ACREDITACIONES
// =========================

doc.setFont(
  "helvetica",
  "bold"
);

doc.setFontSize(11);

doc.text(
  "ACREDITACIONES",
  margin,
  currentY
);

currentY += 4;

autoTable(doc, {
  startY: currentY,

  head: [[
    "Pagador",
    "Canal",
    "Operaciones",
    "Bruto",
    "Neto",
  ]],

  body:
    accreditationSummary.map(
      (item) => [
        item.payer,
        item.channel,
        item.operations,
        formatMoney(
          item.grossAmount
        ),
        formatMoney(
          item.netAmount
        ),
      ]
    ),

  theme: "striped",

  styles: {
    fontSize: 8.5,
    cellPadding: 2.5,
  },

  headStyles: {
    fillColor: [
      71,
      85,
      105,
    ],
    textColor: [
      255,
      255,
      255,
    ],
    fontStyle: "bold",
  },

  columnStyles: {
    2: {
      halign: "center",
    },
    3: {
      halign: "right",
    },
    4: {
      halign: "right",
      fontStyle: "bold",
    },
  },

  margin: {
    left: margin,
    right: margin,
  },
});

currentY =
  (doc as any)
    .lastAutoTable
    .finalY + 10;

// =========================
// RESUMEN POR MEDIO DE PAGO
// =========================

doc.setFont(
  "helvetica",
  "bold"
);

doc.setFontSize(11);

doc.text(
  "RESUMEN POR MEDIO DE PAGO",
  margin,
  currentY
);

currentY += 4;

autoTable(doc, {
  startY: currentY,

  head: [[
    "Medio",
    "Operaciones",
    "Bruto",
    "Neto",
  ]],

  body:
    paymentMethodSummary.map(
      (item) => [
        item.paymentMethod,
        item.operations,
        formatMoney(
          item.grossAmount
        ),
        formatMoney(
          item.netAmount
        ),
      ]
    ),

  theme: "striped",

  styles: {
    fontSize: 8.5,
    cellPadding: 2.5,
  },

  headStyles: {
    fillColor: [
      71,
      85,
      105,
    ],
    textColor: [
      255,
      255,
      255,
    ],
    fontStyle: "bold",
  },

  columnStyles: {
    1: {
      halign: "center",
    },
    2: {
      halign: "right",
    },
    3: {
      halign: "right",
      fontStyle: "bold",
    },
  },

  margin: {
    left: margin,
    right: margin,
  },
});

currentY =
  (doc as any)
    .lastAutoTable
    .finalY + 10;

  // =========================
  // DESGLOSE DE LIQUIDACIÓN
  // =========================

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(11);

  doc.text(
    "DESGLOSE DE LIQUIDACIÓN",
    margin,
    currentY
  );

  currentY += 5;

const liquidationBreakdownRows: string[][] = [
  [
    "Importe bruto",
    formatMoney(
      liquidation.gross_amount
    ),
  ],

  ...taxBreakdown.map(
    (item) => [
      item.label,
      `- ${formatMoney(
        Math.abs(
          toNumber(
            item.amount
          )
        )
      )}`,
    ]
  ),
];

liquidationBreakdownRows.push([
  "Neto a acreditar",
  formatMoney(
    liquidation.merchant_net_amount
  ),
]);

  autoTable(doc, {
    startY: currentY,

    body:
      liquidationBreakdownRows,

    theme: "grid",

    styles: {
      fontSize: 9,
      cellPadding: 3,
    },

    columnStyles: {
      0: {
        fontStyle: "normal",
      },

      1: {
        halign: "right",
        fontStyle: "bold",
      },
    },

    didParseCell: (data) => {
      if (
        data.section === "body" &&
        data.row.index ===
          liquidationBreakdownRows.length -
            1
      ) {
        data.cell.styles.fontStyle =
          "bold";
      }
    },

    margin: {
      left: margin,
      right: margin,
    },
  });

  currentY =
    (doc as any)
      .lastAutoTable
      .finalY + 5;

  doc.setFont(
    "helvetica",
    "normal"
  );

  doc.setFontSize(7.5);
  doc.setTextColor(110);

  doc.text(
    "Neto a acreditar informado por BENEFI.",
    margin,
    currentY
  );

  // Pie primera página

  doc.setFontSize(7.5);
  doc.setTextColor(120);

  doc.text(
    "Liquidación generada por BENEFÍ",
    margin,
    pageHeight - 7
  );

  doc.text(
    "Página 1",
    pageWidth - margin,
    pageHeight - 7,
    {
      align: "right",
    }
  );

  // =========================
  // DETALLE DE OPERACIONES
  // SIEMPRE NUEVA PÁGINA
  // =========================

  doc.addPage();

  currentY = 20;

  doc.setTextColor(40);

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(11);

  doc.text(
    "DETALLE DE OPERACIONES",
    margin,
    currentY
  );

  currentY += 8;

  const paymentMethodOrder = [
    "QR",
    "DEBIT",
    "CREDIT",
    "PREPAID",
  ];

  const paymentMethodLabels: Record<
    string,
    string
  > = {
    QR: "QR",
    DEBIT: "DÉBITO",
    CREDIT: "CRÉDITO",
    PREPAID: "PREPAGO",
  };

  const transactionsByMethod =
    new Map<
      string,
      Transaction[]
    >();

  transactions.forEach(
    (transaction) => {
      const method =
        transaction.payment_method ||
        "OTROS";

      const current =
        transactionsByMethod.get(
          method
        ) || [];

      current.push(
        transaction
      );

      transactionsByMethod.set(
        method,
        current
      );
    }
  );

  const orderedMethods = [
    ...paymentMethodOrder.filter(
      (method) =>
        transactionsByMethod.has(
          method
        )
    ),

    ...Array.from(
      transactionsByMethod.keys()
    ).filter(
      (method) =>
        !paymentMethodOrder.includes(
          method
        )
    ),
  ];

  orderedMethods.forEach(
    (method) => {
      const methodTransactions =
        transactionsByMethod.get(
          method
        ) || [];

      const currentPageHeight =
        doc.internal.pageSize.getHeight();

      if (
        currentY >
        currentPageHeight - 45
      ) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(10);
      doc.setTextColor(40);

      doc.text(
        `${
          paymentMethodLabels[
            method
          ] || method
        } · ${
          methodTransactions.length
        } ${
          methodTransactions.length === 1
            ? "operación"
            : "operaciones"
        }`,
        margin,
        currentY
      );

      currentY += 4;

      autoTable(doc, {
        startY: currentY,

        head: [[
          "Fecha",
          "POS",
          "Operación",
          "Tipo",
          "Marca",
          "Cuotas",
          "Bruto",
          "Neto",
        ]],

        body:
          methodTransactions.map(
            (transaction) => [
              new Intl.DateTimeFormat(
                "es-AR",
                {
                  dateStyle:
                    "short",

                  timeStyle:
                    "short",
                }
              ).format(
                new Date(
                  transaction.transaction_datetime
                )
              ),

              getPosCode(
                transaction.pos_id
              ),

              transaction.operation_number ||
                "-",

              transaction.operation_type ===
              "PAYMENT"
                ? "Venta"
                : transaction.operation_type ===
                  "ANNULMENT"
                ? "Anulación"
                : transaction.operation_type ===
                  "REFUND"
                ? "Devolución"
                : transaction.operation_type ||
                  "-",

              getCardBrand(
                transaction
              ),

              transaction.installments ||
                1,

              formatMoney(
                transaction.gross_amount
              ),

              formatMoney(
                transaction.merchant_net_amount
              ),
            ]
          ),

        theme: "striped",

        styles: {
          fontSize: 7.5,
          cellPadding: 2,
          overflow: "linebreak",
        },

        headStyles: {
          fillColor: [
            30,
            58,
            95,
          ],

          textColor: [
            255,
            255,
            255,
          ],

          fontStyle: "bold",
        },

        columnStyles: {
          0: {
            cellWidth: 28,
          },

          1: {
            cellWidth: 16,
          },

          2: {
            cellWidth: 27,
          },

          3: {
            cellWidth: 21,
          },

          4: {
            cellWidth: 24,
          },

          5: {
            cellWidth: 14,
            halign: "center",
          },

          6: {
            cellWidth: 25,
            halign: "right",
          },

          7: {
            cellWidth: 25,
            halign: "right",
            fontStyle: "bold",
          },
        },

        didParseCell: (
          data
        ) => {
          if (
            data.section ===
              "head" &&
            (data.column.index ===
              6 ||
              data.column.index ===
                7)
          ) {
            data.cell.styles.halign =
              "right";
          }

          if (
            data.section ===
              "head" &&
            data.column.index === 5
          ) {
            data.cell.styles.halign =
              "center";
          }
        },

        margin: {
          left: margin,
          right: margin,
          bottom: 15,
        },

        didDrawPage: () => {
          const currentPageHeight =
            doc.internal.pageSize.getHeight();

          const pageNumber =
            doc.getNumberOfPages();

          doc.setFont(
            "helvetica",
            "normal"
          );

          doc.setFontSize(7.5);
          doc.setTextColor(120);

          doc.text(
            "Liquidación generada por BENEFÍ",
            margin,
            currentPageHeight - 7
          );

          doc.text(
            `Página ${pageNumber}`,
            pageWidth - margin,
            currentPageHeight - 7,
            {
              align: "right",
            }
          );
        },
      });

      currentY =
        (doc as any)
          .lastAutoTable
          .finalY + 9;
    }
  );

  // =========================
  // NOMBRE DEL ARCHIVO
  // =========================

  const merchantName =
    liquidation.merchant_name
      .replace(
        /[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+/g,
        "_"
      )
      .replace(
        /^_+|_+$/g,
        ""
      );

  const paymentDate =
    liquidation.payment_date.replace(
      /-/g,
      ""
    );

  doc.save(
    `Liquidacion_${merchantName}_${paymentDate}.pdf`
  );
}
  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mb-6">
        <button
          type="button"
          onClick={() => {
            window.location.href =
              "/portal-comercio/liquidaciones";
          }}
          className="mb-3 text-sm font-semibold text-slate-600 hover:text-slate-950"
        >
          ← Volver a Liquidaciones
        </button>

        <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-950 md:text-3xl">
            Detalle de liquidación
        </h1>

        <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={exportExcel}
                className="rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
                Exportar Excel
            </button>

            <button
                type="button"
                onClick={exportPDF}
                className="rounded-lg border border-slate-700 bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
                Exportar PDF
            </button>
            </div>
        </div>

        <p className="mt-1 text-sm text-slate-500">
          Operaciones que componen
          la acreditación al comercio.
        </p>
      </div>

      <section className="mb-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">
            Comercio
          </p>

          <p className="mt-1 font-bold text-slate-950">
            {liquidation.merchant_name}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">
            Fecha de pago
          </p>

          <p className="mt-1 font-bold text-slate-950">
            {formatDate(
              liquidation.payment_date
            )}
          </p>
        </div>
      </section>

      <section className="mb-5 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">
            Operaciones
          </p>

          <p className="mt-1 text-xl font-bold text-slate-950">
            {
              liquidation.operation_count
            }
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">
            Importe bruto
          </p>

          <p className="mt-1 text-xl font-bold text-slate-950">
            {formatMoney(
              totals.gross
            )}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">
            Neto a acreditar
          </p>

          <p className="mt-1 text-xl font-bold text-slate-950">
            {formatMoney(
              totals.net
            )}
          </p>
        </div>
      </section>

            <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900">
            Desglose de liquidación
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Detalle de los conceptos aplicados
            sobre las operaciones.
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          <div className="flex items-center justify-between gap-4 py-3">
            <span className="text-sm text-slate-600">
              Importe bruto
            </span>

            <span className="font-semibold text-slate-900">
              {formatMoney(
                liquidation.gross_amount
              )}
            </span>
          </div>

          {taxBreakdown.map((item) => (
            <div
              key={item.tax_code}
              className="flex items-center justify-between gap-4 py-3"
            >
              <span className="text-sm text-slate-600">
                {item.label}
              </span>

              <span className="font-semibold text-slate-900">
                -{" "}
                {formatMoney(
                  Math.abs(
                    toNumber(
                      item.amount
                    )
                  )
                )}
              </span>
            </div>
          ))}

          <div className="flex items-center justify-between gap-4 pt-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Neto a acreditar
              </p>

              <p className="mt-0.5 text-xs text-slate-500">
                Importe informado por BENEFI
              </p>
            </div>

            <span className="text-lg font-bold text-emerald-700">
              {formatMoney(
                liquidation.merchant_net_amount
              )}
            </span>
          </div>
        </div>
      </section>

      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900">
            Acreditaciones
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Importes que el comercio debe identificar
            según el pagador.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">
                  Pagador
                </th>

                <th className="px-4 py-3 text-left font-semibold">
                  Canal
                </th>

                <th className="px-4 py-3 text-center font-semibold">
                  Operaciones
                </th>

                <th className="px-4 py-3 text-right font-semibold">
                  Bruto
                </th>

                <th className="px-4 py-3 text-right font-semibold">
                  Neto
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {accreditationSummary.map((item) => (
                <tr
                  key={`${item.payer}-${item.channel}`}
                  className="text-sm text-slate-700"
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {item.payer}
                  </td>

                  <td className="px-4 py-3">
                    {item.channel}
                  </td>

                  <td className="px-4 py-3 text-center">
                    {item.operations}
                  </td>

                  <td className="px-4 py-3 text-right">
                    {formatMoney(
                      item.grossAmount
                    )}
                  </td>

                  <td className="px-4 py-3 text-right font-bold text-slate-950">
                    {formatMoney(
                      item.netAmount
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900">
            Resumen por medio de pago
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Distribución de la liquidación según
            el medio de pago utilizado.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">
                  Medio
                </th>

                <th className="px-4 py-3 text-center font-semibold">
                  Operaciones
                </th>

                <th className="px-4 py-3 text-right font-semibold">
                  Bruto
                </th>

                <th className="px-4 py-3 text-right font-semibold">
                  Neto
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {paymentMethodSummary.map((item) => (
                <tr
                  key={item.paymentMethod}
                  className="text-sm text-slate-700"
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {item.paymentMethod}
                  </td>

                  <td className="px-4 py-3 text-center">
                    {item.operations}
                  </td>

                  <td className="px-4 py-3 text-right">
                    {formatMoney(
                      item.grossAmount
                    )}
                  </td>

                  <td className="px-4 py-3 text-right font-bold text-slate-950">
                    {formatMoney(
                      item.netAmount
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900">
            Filtros de operaciones
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Los filtros afectan únicamente el detalle de operaciones.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              POS
            </label>

            <select
              value={posFilter}
              onChange={(event) =>
                setPosFilter(event.target.value)
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
            >
              <option value="">
                Todos los POS
              </option>

              {posDevices.map((pos) => (
                <option
                  key={pos.id}
                  value={pos.id}
                >
                  {getPosCode(pos.id)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Medio de pago
            </label>

            <select
              value={paymentMethodFilter}
              onChange={(event) =>
                setPaymentMethodFilter(
                  event.target.value
                )
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
            >
              <option value="">
                Todos
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
                Prepago
              </option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Buscar operación
            </label>

            <input
              type="text"
              value={operationSearch}
              onChange={(event) =>
                setOperationSearch(
                  event.target.value
                )
              }
              placeholder="N° operación"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
            />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Operaciones incluidas
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {filteredTransactions.length} operaciones encontradas
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] border-collapse">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">
                  Fecha operación
                </th>

                <th className="px-4 py-3 text-left font-semibold">
                  POS
                </th>

                <th className="px-4 py-3 text-left font-semibold">
                  Operación
                </th>

                <th className="px-4 py-3 text-left font-semibold">
                  Tipo
                </th>

                <th className="px-4 py-3 text-left font-semibold">
                  Medio
                </th>

                <th className="px-4 py-3 text-left font-semibold">
                  Marca
                </th>

                <th className="px-4 py-3 text-right font-semibold">
                  Cuotas
                </th>

                <th className="px-4 py-3 text-right font-semibold">
                  Bruto
                </th>

                <th className="px-4 py-3 text-right font-semibold">
                  Neto
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredTransactions.map(
                (transaction) => (
                  <tr
                    key={
                      transaction.id
                    }
                    className="border-t border-slate-100 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      {new Intl.DateTimeFormat(
                        "es-AR",
                        {
                          dateStyle:
                            "short",
                          timeStyle:
                            "short",
                        }
                      ).format(
                        new Date(
                          transaction.transaction_datetime
                        )
                      )}
                    </td>

                    <td className="px-4 py-3 font-medium">
                      {getPosCode(
                        transaction.pos_id
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {transaction.operation_number ||
                        "-"}
                    </td>

                    <td className="px-4 py-3">
                      {transaction.operation_type ===
                      "PAYMENT"
                        ? "Venta"
                        : transaction.operation_type ===
                          "ANNULMENT"
                        ? "Anulación"
                        : transaction.operation_type ===
                          "REFUND"
                        ? "Devolución"
                        : transaction.operation_type ||
                          "-"}
                    </td>

                    <td className="px-4 py-3">
                      {transaction.payment_method ||
                        "-"}
                    </td>

                    <td className="px-4 py-3">
                      {getCardBrand(
                        transaction
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {transaction.installments ||
                        1}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {formatMoney(
                        transaction.gross_amount
                      )}
                    </td>

                    <td className="px-4 py-3 text-right font-bold text-slate-950">
                      {formatMoney(
                        transaction.merchant_net_amount
                      )}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}