"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
  cuit: string | null;
  address: string | null;
  street: string | null;
  street_number: string | null;
  floor: string | null;
  apartment: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
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

  const [pdfMonth, setPdfMonth] =
  useState(
    firstDayOfMonth().slice(0, 7)
  );

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

  function exportMonthlyPDF() {
  const [pdfYear, pdfMonthNumber] =
    pdfMonth.split("-");

  const pdfLiquidations =
    liquidations.filter((item) =>
      item.merchant_payment_date.startsWith(
        `${pdfYear}-${pdfMonthNumber}`
      )
    );

  if (pdfLiquidations.length === 0) {
    setMessage(
      "No hay liquidaciones para el mes seleccionado."
    );
    return;
  }

  setMessage("");

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

  const merchant =
    merchants.length === 1
      ? merchants[0]
      : null;

  // =========================
  // DOMICILIO DEL COMERCIO
  // =========================

  const addressParts: string[] = [];

  if (merchant?.street) {
    let streetLine = merchant.street;

    if (merchant.street_number) {
      streetLine += ` ${merchant.street_number}`;
    }

    addressParts.push(streetLine);
  } else if (merchant?.address) {
    addressParts.push(merchant.address);
  }

  if (merchant?.floor) {
    addressParts.push(
      `Piso ${merchant.floor}`
    );
  }

  if (merchant?.apartment) {
    addressParts.push(
      `Dpto. ${merchant.apartment}`
    );
  }

  const locationParts = [
    merchant?.city,
    merchant?.province,
  ].filter(Boolean);

  if (locationParts.length > 0) {
    addressParts.push(
      locationParts.join(", ")
    );
  }

  if (merchant?.postal_code) {
    addressParts.push(
      `CP ${merchant.postal_code}`
    );
  }

  const merchantAddress =
    addressParts.join(" · ") || "-";

  // =========================
  // PERÍODO
  // =========================

  const year = Number(pdfYear);
  const month = Number(pdfMonthNumber); 

  const periodLabel =
    new Intl.DateTimeFormat("es-AR", {
      month: "long",
      year: "numeric",
    }).format(
      new Date(year, month - 1, 1)
    );

  const formattedPeriod =
    periodLabel.charAt(0).toUpperCase() +
    periodLabel.slice(1);

  // =========================
  // ENCABEZADO
  // =========================

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("BENEFÍ", margin, 17);

  doc.setFontSize(15);
  doc.text(
    "LIQUIDACIONES DEL MES",
    margin,
    27
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);

  doc.text(
    "Resumen mensual de acreditaciones al comercio",
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

  doc.setFont("helvetica", "bold");
  doc.text("Comercio", margin, 47);

  doc.setFont("helvetica", "normal");

  doc.text(
    merchant?.name || merchantName,
    margin,
    52
  );

  // CUIT

  doc.setFont("helvetica", "bold");
  doc.text("CUIT", margin, 60);

  doc.setFont("helvetica", "normal");

  doc.text(
    merchant?.cuit || "-",
    margin,
    65
  );

  // Domicilio

  doc.setFont("helvetica", "bold");
  doc.text("Domicilio", margin, 73);

  doc.setFont("helvetica", "normal");

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

  // Período

  doc.setFont("helvetica", "bold");

  doc.text(
    "Período",
    150,
    47
  );

  doc.setFont("helvetica", "normal");

  doc.text(
    formattedPeriod,
    150,
    52
  );

  // =========================
  // TOTALES
  // =========================

const totalOperations =
  pdfLiquidations.reduce(
    (total, item) =>
      total +
      toNumber(item.operation_count),
    0
  );

const totalGross =
  pdfLiquidations.reduce(
    (total, item) =>
      total +
      toNumber(item.gross_amount),
    0
  );

const totalNet =
  pdfLiquidations.reduce(
    (total, item) =>
      total +
      toNumber(
        item.merchant_net_amount
      ),
    0
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);

  doc.text(
    "CONSOLIDADO DEL MES",
    margin,
    92
  );

  autoTable(doc, {
    startY: 96,

    head: [[
      "Liquidaciones",
      "Operaciones",
      "Importe bruto",
      "Neto a acreditar",
    ]],

    body: [[
      filteredLiquidations.length,
      totalOperations,
      formatMoney(totalGross),
      formatMoney(totalNet),
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
        halign: "center",
      },
      2: {
        halign: "right",
      },
      3: {
        halign: "right",
      },
    },

    margin: {
      left: margin,
      right: margin,
    },
  });

  let currentY =
    (doc as any).lastAutoTable.finalY +
    10;

  // =========================
  // LIQUIDACIONES
  // =========================

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);

  doc.text(
    "DETALLE DE LIQUIDACIONES",
    margin,
    currentY
  );

  currentY += 4;

  autoTable(doc, {
    startY: currentY,

    head: [[
      "Fecha pago",
      "Operaciones",
      "POS",
      "Bruto",
      "Neto",
    ]],

    body: filteredLiquidations.map(
      (item) => [
        formatDate(
          item.merchant_payment_date
        ),
        toNumber(
          item.operation_count
        ).toString(),
        item.pos_codes || "-",
        formatMoney(
          item.gross_amount
        ),
        formatMoney(
          item.merchant_net_amount
        ),
      ]
    ),

    theme: "striped",

    styles: {
      fontSize: 8,
      cellPadding: 2.5,
    },

    headStyles: {
      fillColor: [71, 85, 105],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "left",
    },

    didParseCell: (data) => {
      if (
        data.section === "head" &&
        (data.column.index === 3 ||
          data.column.index === 4)
      ) {
        data.cell.styles.halign = "right";
      }
    },

    columnStyles: {
      0: {
        cellWidth: 26,
      },
      1: {
        halign: "center",
        cellWidth: 24,
      },
      2: {
        cellWidth: 61,
      },
      3: {
        halign: "right",
        cellWidth: 36,
      },
      4: {
        halign: "right",
        cellWidth: 36,
        fontStyle: "bold",
      },
    },

    margin: {
      left: margin,
      right: margin,
      bottom: 14,
    },

    didDrawPage: (data) => {
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
        `Página ${data.pageNumber}`,
        pageWidth - margin,
        pageHeight - 7,
        {
          align: "right",
        }
      );
    },
  });

  // =========================
  // DESCARGA
  // =========================

  const filePeriod =
  `${pdfYear}-${pdfMonthNumber}`;

  doc.save(
    `liquidaciones-${filePeriod}.pdf`
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
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Detalle de liquidaciones
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {filteredLiquidations.length} liquidaciones encontradas
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Mes a exportar
              </label>

              <input
                type="month"
                value={pdfMonth}
                onChange={(event) =>
                  setPdfMonth(event.target.value)
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm sm:w-auto"
              />
            </div>

            <button
              type="button"
              onClick={exportMonthlyPDF}
              disabled={
                loading || !pdfMonth
              }
              className="inline-flex items-center justify-center rounded-lg bg-[#1E3A5F] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#162d4a] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Exportar PDF
            </button>
          </div>
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