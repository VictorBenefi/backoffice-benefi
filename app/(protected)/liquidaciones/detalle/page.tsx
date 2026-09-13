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
    } | null;
  } | null;
};

type Liquidation = {
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
  payer: string;
  channel: string;

  operation_count: number;
  pos_count: number;

  gross_amount: number;

  merchant_commission: number;
  merchant_commission_vat: number;

  financial_cost: number;
  financial_cost_vat: number;

  calculated_net_amount: number;
  merchant_net_amount: number;

  reconciliation_difference: number;
};

type PosDevice = {
  id: string;
  code: string;
  serial: string | null;
  merchant_reference: string | null;
};

function PayerBadge({
  payer,
}: {
  payer: string;
}) {
  const isQr = payer === "QRPCT";

  return (
    <span
      className={
        isQr
          ? "inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700"
          : "inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700"
      }
    >
      {payer}
    </span>
  );
}

export default function LiquidacionDetallePage() {
  const searchParams = useSearchParams();

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [liquidation, setLiquidation] =
    useState<Liquidation | null>(null);

  const [transactions, setTransactions] =
    useState<Transaction[]>([]);

  const [posDevices, setPosDevices] =
    useState<PosDevice[]>([]);

    const [posFilter, setPosFilter] =
    useState("");

    const [paymentMethodFilter, setPaymentMethodFilter] =
    useState("");

    const [search, setSearch] =
    useState("");

  useEffect(() => {
    async function loadDetail() {
      try {
        setLoading(true);
        setError("");

        const merchantId =
            searchParams.get("merchant_id");

            const paymentDate =
            searchParams.get("payment_date");

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
                merchant_id: merchantId,
                payment_date: paymentDate,
        });

        const response = await fetch(
          `/api/liquidaciones/detalle?${params.toString()}`,
          {
            cache: "no-store",
          }
        );

        const data =
          await response.json();

        if (!response.ok || !data.ok) {
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
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo cargar la liquidación."
        );
      } finally {
        setLoading(false);
      }
    }

    loadDetail();
  }, [searchParams]);

  function toNumber(
    value: number | string | null
  ) {
    return Number(value || 0);
  }

  function formatMoney(
    value: number | string | null
  ) {
    return new Intl.NumberFormat(
      "es-AR",
      {
        style: "currency",
        currency: "ARS",
      }
    ).format(toNumber(value));
  }

  function formatDate(
  value: string
) {
  return new Intl.DateTimeFormat(
    "es-AR"
  ).format(
    new Date(
      `${value}T12:00:00`
    )
  );
}
function getMerchantAddress(
  liquidation: Liquidation
) {
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

  return (
    addressParts.join(" · ") ||
    "-"
  );
}

function getPosCode(
  posId: string | null
) {
  if (!posId) {
    return "Sin POS";
  }

  const pos = posDevices.find(
    (item) => item.id === posId
  );

  if (!pos) {
    return "Sin POS";
  }

  const serialSuffix = pos.serial
    ? pos.serial.slice(-5)
    : "";

  if (
    pos.merchant_reference &&
    serialSuffix
  ) {
    return `${pos.merchant_reference} / ${serialSuffix}`;
  }

  if (serialSuffix) {
    return serialSuffix;
  }

  return pos.code || "Sin POS";
}
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

  const filteredTransactions =
  useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    return transactions.filter(
      (transaction) => {
        
        if (
          posFilter &&
          transaction.pos_id !== posFilter
        ) {
          return false;
        }

        if (
          paymentMethodFilter &&
          transaction.payment_method !==
            paymentMethodFilter
        ) {
          return false;
        }

        if (normalizedSearch) {
          const operationNumber =
            String(
              transaction.operation_number ||
                ""
            ).toLowerCase();

          if (
            !operationNumber.includes(
              normalizedSearch
            )
          ) {
            return false;
          }
        }

        return true;
      }
    );
  }, [
    transactions,
    posFilter,
    paymentMethodFilter,
    search,
  ]);

const paymentMethods =
  useMemo<string[]>(() => {
    return Array.from(
      new Set(
        transactions
          .map(
            (transaction) =>
              transaction.payment_method
          )
          .filter(
            (
              paymentMethod
            ): paymentMethod is string =>
              Boolean(paymentMethod)
          )
      )
    ).sort();
  }, [transactions]);

  function getCardBrand(
  transaction: Transaction
) {
  return (
    transaction.operation_detail?.card
      ?.card_brand || "-"
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
  liquidation.gross_amount,
],
[
  "Comisión BENEFÍ",
  -Math.abs(
    toNumber(
      liquidation.merchant_commission
    )
  ),
],
[
  "IVA sobre comisión BENEFÍ",
  -Math.abs(
    toNumber(
      liquidation.merchant_commission_vat
    )
  ),
],

...(Math.abs(
  toNumber(
    liquidation.financial_cost
  )
) > 0
  ? [
      [
        "Costo financiero",
        -Math.abs(
          toNumber(
            liquidation.financial_cost
          )
        ),
      ],
    ]
  : []),

...(Math.abs(
  toNumber(
    liquidation.financial_cost_vat
  )
) > 0
  ? [
      [
        "IVA sobre costo financiero",
        -Math.abs(
          toNumber(
            liquidation.financial_cost_vat
          )
        ),
      ],
    ]
  : []),

[
  "Neto a acreditar",
  liquidation.merchant_net_amount,
],

[
  "Conciliación",
  Math.abs(
    toNumber(
      liquidation.reconciliation_difference
    )
  ) <= 1
    ? "Conciliada"
    : "Diferencia",
],

[
  "Diferencia de conciliación",
  liquidation.reconciliation_difference,
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
["RESUMEN POR MEDIO DE PAGO", ""],
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
    { wch: 28 },
    { wch: 18 },
    { wch: 18 },
  ];

  XLSX.utils.book_append_sheet(
    workbook,
    summarySheet,
    "Resumen"
  );

  const operationRows =
    filteredTransactions.map(
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

        "Medio de pago":
          transaction.payment_method ||
          "",

        Marca:
          getCardBrand(transaction),

        Cuotas:
          transaction.installments || 1,

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

  const margin = 14;

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

// =========================
// DATOS DE LIQUIDACIÓN
// =========================

doc.setTextColor(40);
doc.setFontSize(9);

doc.setFont("helvetica", "bold");
doc.text("Comercio", margin, 47);

doc.setFont(
  "helvetica",
  "normal"
);
doc.text(
  liquidation.merchant_name,
  margin,
  52
);

doc.setFont("helvetica", "bold");
doc.text("CUIT", margin, 60);

doc.setFont(
  "helvetica",
  "normal"
);
doc.text(
  liquidation.merchant_cuit || "-",
  margin,
  65
);

doc.setFont("helvetica", "bold");
doc.text("Domicilio", margin, 73);

doc.setFont(
  "helvetica",
  "normal"
);

const merchantAddress =
  getMerchantAddress(liquidation);

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

doc.setFont("helvetica", "bold");
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

  doc.setFont("helvetica", "bold");
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
      fillColor: [30, 58, 95],
      textColor: [255, 255, 255],
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
    (doc as any).lastAutoTable
      .finalY + 10;

// =========================
// ACREDITACIONES
// =========================

doc.setFont("helvetica", "bold");
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
    fillColor: [71, 85, 105],
    textColor: [255, 255, 255],
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
  (doc as any).lastAutoTable
    .finalY + 10;


  // =========================
  // RESUMEN MEDIOS DE PAGO
  // =========================

  doc.setFont("helvetica", "bold");
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
      fillColor: [71, 85, 105],
      textColor: [255, 255, 255],
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
    (doc as any).lastAutoTable
      .finalY + 10;

// =========================
// DESGLOSE DE LIQUIDACIÓN
// =========================

doc.setFont("helvetica", "bold");
doc.setFontSize(11);

doc.text(
  "DESGLOSE DE LIQUIDACIÓN",
  margin,
  currentY
);

currentY += 4;

const liquidationBreakdownRows: (
  | string
  | number
)[][] = [
  [
    "Importe bruto",
    formatMoney(
      liquidation.gross_amount
    ),
  ],
  [
    "Comisión BENEFÍ",
    `- ${formatMoney(
      Math.abs(
        toNumber(
          liquidation.merchant_commission
        )
      )
    )}`,
  ],
  [
    "IVA sobre comisión BENEFÍ",
    `- ${formatMoney(
      Math.abs(
        toNumber(
          liquidation.merchant_commission_vat
        )
      )
    )}`,
  ],
];

if (
  Math.abs(
    toNumber(
      liquidation.financial_cost
    )
  ) > 0
) {
  liquidationBreakdownRows.push([
    "Costo financiero",
    `- ${formatMoney(
      Math.abs(
        toNumber(
          liquidation.financial_cost
        )
      )
    )}`,
  ]);
}

if (
  Math.abs(
    toNumber(
      liquidation.financial_cost_vat
    )
  ) > 0
) {
  liquidationBreakdownRows.push([
    "IVA sobre costo financiero",
    `- ${formatMoney(
      Math.abs(
        toNumber(
          liquidation.financial_cost_vat
        )
      )
    )}`,
  ]);
}

liquidationBreakdownRows.push([
  "Neto a acreditar",
  formatMoney(
    liquidation.merchant_net_amount
  ),
]);

liquidationBreakdownRows.push([
  "Conciliación",
  Math.abs(
    toNumber(
      liquidation.reconciliation_difference
    )
  ) <= 1
    ? "Conciliada"
    : `Diferencia: ${formatMoney(
        liquidation.reconciliation_difference
      )}`,
]);

autoTable(doc, {
  startY: currentY,

  body: liquidationBreakdownRows,

  theme: "grid",

  styles: {
    fontSize: 8.5,
    cellPadding: 2.5,
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

  margin: {
    left: margin,
    right: margin,
  },
});

currentY =
  (doc as any).lastAutoTable
    .finalY + 10;

// =========================
// DETALLE DE OPERACIONES
// =========================

// El detalle siempre comienza
// en una página nueva
doc.addPage();
currentY = 20;

doc.setFont("helvetica", "bold");
doc.setFontSize(11);

doc.text(
  "DETALLE DE OPERACIONES",
  margin,
  currentY
);

currentY += 7;

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
  new Map<string, typeof transactions>();

transactions.forEach(
  (transaction) => {
    const method =
      transaction.payment_method ||
      "OTROS";

    const current =
      transactionsByMethod.get(
        method
      ) || [];

    current.push(transaction);

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

    const pageHeight =
      doc.internal.pageSize.getHeight();

    if (
      currentY >
      pageHeight - 45
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
        methodTransactions.length ===
        1
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

            getCardBrand(transaction),

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

      didParseCell: (data) => {
        if (
          data.section === "head" &&
          (data.column.index === 6 ||
            data.column.index === 7)
        ) {
          data.cell.styles.halign = "right";
        }

        if (
          data.section === "head" &&
          data.column.index === 5
        ) {
          data.cell.styles.halign = "center";
        }
      },

      margin: {
        left: margin,
        right: margin,
        bottom: 15,
      },

      didDrawPage: () => {
        const pageHeight =
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
          pageHeight - 7
        );

        doc.text(
          `Página ${pageNumber}`,
          pageWidth - margin,
          pageHeight - 7,
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
      .replace(/^_+|_+$/g, "");

  const paymentDate =
    liquidation.payment_date.replace(
      /-/g,
      ""
    );

  doc.save(
    `Liquidacion_${merchantName}_${paymentDate}.pdf`
  );
}

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

        groups.set(key, current);
      }
    );

    return Array.from(
      groups.values()
    );
}, [transactions]);

    if (loading) {
    return (
      <div className="p-6 text-sm text-slate-600">
        Cargando detalle de liquidación...
      </div>
    );
  }

  if (error || !liquidation) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error ||
            "No se encontró la liquidación."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <button
            type="button"
            onClick={() => {
                window.location.href =
                "/liquidaciones";
            }}
            className="mb-3 text-sm font-semibold text-slate-600 hover:text-slate-950"
            >
            ← Volver a Liquidaciones
        </button>

        <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold text-slate-950">
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
          Operaciones que componen el pago al comercio.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">
            Comercio
          </div>

          <div className="mt-1 font-bold text-slate-950">
            {liquidation.merchant_name}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">
            Fecha de pago
          </div>

          <div className="mt-1 font-bold text-slate-950">
            {formatDate(
              liquidation.payment_date
            )}
          </div>
        </div>
      
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">
            Operaciones
          </div>

          <div className="mt-1 text-xl font-bold text-slate-950">
            {liquidation.operation_count}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">
            Importe bruto
          </div>

          <div className="mt-1 text-xl font-bold text-slate-950">
            {formatMoney(
              liquidation.gross_amount
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">
            Neto a acreditar
          </div>

          <div className="mt-1 text-xl font-bold text-slate-950">
            {formatMoney(
              liquidation.merchant_net_amount
            )}
          </div>
        </div>

        </div>
        {/* DESGLOSE DE LIQUIDACIÓN */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-4">
            <h2 className="font-semibold text-slate-950">
              Desglose de liquidación
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Detalle de los conceptos aplicados para
              determinar el importe neto a acreditar.
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            <LiquidationConcept
              label="Importe bruto"
              value={liquidation.gross_amount}
            />

            <LiquidationConcept
              label="Comisión BENEFÍ"
              value={liquidation.merchant_commission}
              negative
            />

            <LiquidationConcept
              label="IVA sobre comisión BENEFÍ"
              value={
                liquidation.merchant_commission_vat
              }
              negative
            />

            {Math.abs(
              toNumber(liquidation.financial_cost)
            ) > 0 && (
              <LiquidationConcept
                label="Costo financiero"
                value={liquidation.financial_cost}
                negative
              />
            )}

            {Math.abs(
              toNumber(
                liquidation.financial_cost_vat
              )
            ) > 0 && (
              <LiquidationConcept
                label="IVA sobre costo financiero"
                value={
                  liquidation.financial_cost_vat
                }
                negative
              />
            )}

            <div className="flex items-center justify-between gap-4 pt-4">
              <div>
                <p className="font-semibold text-slate-950">
                  Neto a acreditar
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Importe informado por MENTA
                </p>
              </div>

              <p className="text-xl font-bold text-slate-950">
                {formatMoney(
                  liquidation.merchant_net_amount
                )}
              </p>
            </div>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4">
            {Math.abs(
              toNumber(
                liquidation.reconciliation_difference
              )
            ) <= 1 ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-500">
                  Conciliación
                </span>

                <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  Conciliada
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-slate-500">
                  Diferencia de conciliación
                </span>

                <div className="flex items-center gap-3">
                  <span className="font-semibold text-amber-700">
                    {formatMoney(
                      liquidation.reconciliation_difference
                    )}
                  </span>

                  <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                    Diferencia
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

{/* ACREDITACIONES */}
<div className="rounded-xl border border-slate-200 bg-white p-4">
  <div className="mb-3">
    <h2 className="font-semibold text-slate-950">
      Acreditaciones
    </h2>

    <p className="mt-1 text-sm text-slate-500">
      Importes que el comercio debe identificar
      según el pagador.
    </p>
  </div>

  <div className="flex flex-wrap gap-3">
    {accreditationSummary.map(
      (item) => (
        <div
          key={`${item.payer}-${item.channel}`}
          className="min-w-[420px] flex-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
        >
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <PayerBadge
              payer={item.payer}
            />

            <div className="font-semibold text-slate-700">
              {item.channel}
            </div>

            <div>
              <span className="text-slate-500">
                Operaciones:{" "}
              </span>

              <span className="font-semibold">
                {item.operations}
              </span>
            </div>

            <div>
              <span className="text-slate-500">
                Bruto:{" "}
              </span>

              <span className="font-semibold">
                {formatMoney(
                  item.grossAmount
                )}
              </span>
            </div>

            <div>
              <span className="text-slate-500">
                Neto a acreditar:{" "}
              </span>

              <span className="font-bold text-slate-950">
                {formatMoney(
                  item.netAmount
                )}
              </span>
            </div>
          </div>
        </div>
      )
    )}
  </div>
</div>

{/* RESUMEN POR MEDIO DE PAGO */}
<div className="rounded-xl border border-slate-200 bg-white p-4">
  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
    <div>
      <h2 className="font-semibold text-slate-950">
        Resumen por medio de pago
      </h2>

            <p className="mt-1 text-sm text-slate-500">
                Distribución de la liquidación según
                el medio de pago utilizado.
            </p>
            </div>
            
        </div>

        <div className="flex flex-wrap gap-3">
            {paymentMethodSummary.map(
            (item) => (
                <div
                    key={item.paymentMethod}
                    className="min-w-[420px] flex-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                        <div className="font-bold text-slate-950">
                        {item.paymentMethod}
                        </div>

                        <div>
                        <span className="text-slate-500">
                            Operaciones:{" "}
                        </span>
                        <span className="font-semibold text-slate-900">
                            {item.operations}
                        </span>
                        </div>

                        <div>
                        <span className="text-slate-500">
                            Bruto:{" "}
                        </span>
                        <span className="font-semibold text-slate-900">
                            {formatMoney(
                            item.grossAmount
                            )}
                        </span>
                        </div>

                        <div>
                        <span className="text-slate-500">
                            Neto:{" "}
                        </span>
                        <span className="font-bold text-slate-950">
                            {formatMoney(
                            item.netAmount
                            )}
                        </span>
                        </div>
                    </div>
                    </div>            )
            )}
        </div>
        </div>

    <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-4">
            <h2 className="font-semibold text-slate-950">
            Filtros de operaciones
            </h2>

            <p className="mt-1 text-sm text-slate-500">
            Los filtros afectan únicamente el detalle
            de operaciones.
            </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
            <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">
                POS
            </label>

            <select
                value={posFilter}
                onChange={(e) =>
                setPosFilter(e.target.value)
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
            >
                <option value="">
                Todos
                </option>

                {posDevices.map((pos) => (
                <option
                    key={pos.id}
                    value={pos.id}
                >
                    {pos.code}
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
                onChange={(e) =>
                setPaymentMethodFilter(
                    e.target.value
                )
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
            >
                <option value="">
                Todos
                </option>

                {paymentMethods.map(
                (paymentMethod) => (
                    <option
                    key={paymentMethod}
                    value={paymentMethod}
                    >
                    {paymentMethod}
                    </option>
                )
                )}
            </select>
            </div>

            <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">
                Buscar operación
            </label>

            <input
                type="text"
                value={search}
                onChange={(e) =>
                setSearch(e.target.value)
                }
                placeholder="N° operación"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
            </div>
        </div>
        </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-4">
          <h2 className="font-semibold text-slate-950">
            Operaciones incluidas
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {filteredTransactions.length} operaciones encontradas
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">
                  Fecha operación
                </th>

                <th className="px-4 py-3 text-left">
                  POS
                </th>

                <th className="px-4 py-3 text-left">
                  Operación
                </th>

                <th className="px-4 py-3 text-left">
                  Medio
                </th>

                <th className="px-4 py-3 text-left">
                  Marca
                </th>

                <th className="px-4 py-3 text-right">
                  Cuotas
                </th>

                <th className="px-4 py-3 text-right">
                  Bruto
                </th>

                <th className="px-4 py-3 text-right">
                  Neto
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.map(
                (transaction) => (
                  <tr
                    key={transaction.id}
                    className="hover:bg-slate-50"
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
                      {transaction.payment_method ||
                        "-"}
                    </td>

                    <td className="px-4 py-3">
                      {getCardBrand(transaction)}
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

                    <td className="px-4 py-3 text-right font-semibold">
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
      </div>
    </div>
  );
}
function LiquidationConcept({
  label,
  value,
  negative = false,
}: {
  label: string;
  value: number | string | null;
  negative?: boolean;
}) {
  const amount = Number(value || 0);

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-sm text-slate-600">
        {label}
      </span>

      <span
        className={
          negative
            ? "font-semibold text-slate-700"
            : "font-semibold text-slate-950"
        }
      >
        {negative && amount !== 0
          ? "- "
          : ""}
        {new Intl.NumberFormat("es-AR", {
          style: "currency",
          currency: "ARS",
        }).format(Math.abs(amount))}
      </span>
    </div>
  );
}