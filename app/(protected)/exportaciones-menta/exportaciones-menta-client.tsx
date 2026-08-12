"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  downloadMerchantDocumentsZip,
} from "@/lib/merchant-documents";

type Merchant = {
  id: string;
  name: string | null;
  legal_name: string | null;
  cuit: string | null;

  entity_type: string | null;

  province: string | null;
  city: string | null;
  postal_code: string | null;

  street: string | null;
  street_number: string | null;
  floor: string | null;
  apartment: string | null;

  tax_condition: string | null;

  bank_cbu: string | null;
  bank_account_type: string | null;

  representative_first_name: string | null;
  representative_last_name: string | null;
  representative_cuit: string | null;
  representative_role: string | null;
  representative_email: string | null;
  representative_phone: string | null;

  contracted_services: string[] | null;

  created_at: string;
};

type MissingField = {
  label: string;
  field: string;
};

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10";

const REQUIRED_MENTA_FIELDS: MissingField[] = [
  {
    label: "Nombre de la empresa",
    field: "name",
  },
  {
    label: "Entidad",
    field: "entity_type",
  },
  {
    label: "Razón social",
    field: "legal_name",
  },
  {
    label: "CUIT",
    field: "cuit",
  },
  {
    label: "Provincia",
    field: "province",
  },
  {
    label: "Ciudad",
    field: "city",
  },
  {
    label: "CPA",
    field: "postal_code",
  },
  {
    label: "Calle",
    field: "street",
  },
  {
    label: "CBU/CVU",
    field: "bank_cbu",
  },
  {
    label: "Tipo de cuenta",
    field: "bank_account_type",
  },
  {
    label: "Condición impositiva",
    field: "tax_condition",
  },
  {
    label: "Nombre del contacto",
    field: "representative_first_name",
  },
  {
    label: "Apellido del contacto",
    field: "representative_last_name",
  },
  {
    label: "CUIT del contacto",
    field: "representative_cuit",
  },
  {
    label: "Carácter",
    field: "representative_role",
  },
  {
    label: "Email",
    field: "representative_email",
  },
  {
    label: "Teléfono",
    field: "representative_phone",
  },
];

export default function ExportacionesMentaClient() {
  const supabase = useMemo(() => createClient(), []);

  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [downloadingZipId, setDownloadingZipId] =
  useState<string | null>(null);

  const loadMerchants = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("merchants")
      .select(`
        id,
        name,
        legal_name,
        cuit,
        entity_type,
        province,
        city,
        postal_code,
        street,
        street_number,
        floor,
        apartment,
        tax_condition,
        bank_cbu,
        bank_account_type,
        representative_first_name,
        representative_last_name,
        representative_cuit,
        representative_role,
        representative_email,
        representative_phone,
        contracted_services,
        created_at
      `)
      .order("created_at", {
        ascending: false,
      });

    setLoading(false);

    if (error) {
      console.error(error);

      toast.error(
        `No se pudieron cargar los comercios: ${error.message}`
      );

      return;
    }

    setMerchants((data || []) as Merchant[]);
  };

  useEffect(() => {
    loadMerchants();
  }, []);

  const filteredMerchants = useMemo(() => {
    const text = search.trim().toLowerCase();

    return merchants.filter((merchant) => {
      if (!text) return true;

      return (
        (merchant.name || "")
          .toLowerCase()
          .includes(text) ||
        (merchant.legal_name || "")
          .toLowerCase()
          .includes(text) ||
        (merchant.cuit || "")
          .toLowerCase()
          .includes(text) ||
        (merchant.city || "")
          .toLowerCase()
          .includes(text) ||
        (merchant.province || "")
          .toLowerCase()
          .includes(text)
      );
    });
  }, [merchants, search]);

  const selectedMerchants = useMemo(() => {
    return merchants.filter((merchant) =>
      selectedIds.includes(merchant.id)
    );
  }, [merchants, selectedIds]);

  const getMissingFields = (
    merchant: Merchant
  ): MissingField[] => {
    return REQUIRED_MENTA_FIELDS.filter(
      (requiredField) => {
        const value =
          merchant[
            requiredField.field as keyof Merchant
          ];

        if (Array.isArray(value)) {
          return value.length === 0;
        }

        return (
          value === null ||
          value === undefined ||
          String(value).trim() === ""
        );
      }
    );
  };

  const getCompletedCount = (
    merchant: Merchant
  ) => {
    const missing = getMissingFields(merchant);

    return (
      REQUIRED_MENTA_FIELDS.length -
      missing.length
    );
  };

  const toggleMerchant = (merchantId: string) => {
    setSelectedIds((previous) =>
      previous.includes(merchantId)
        ? previous.filter(
            (id) => id !== merchantId
          )
        : [...previous, merchantId]
    );
  };

  const selectAllVisible = () => {
    const visibleIds =
      filteredMerchants.map(
        (merchant) => merchant.id
      );

    setSelectedIds((previous) => {
      const alreadyAllSelected =
        visibleIds.length > 0 &&
        visibleIds.every((id) =>
          previous.includes(id)
        );

      if (alreadyAllSelected) {
        return previous.filter(
          (id) => !visibleIds.includes(id)
        );
      }

      return Array.from(
        new Set([
          ...previous,
          ...visibleIds,
        ])
      );
    });
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const entityLabel = (
    entityType: string | null
  ) => {
    if (entityType === "company") {
      return "Persona Jurídica";
    }

    if (entityType === "individual") {
      return "Persona Humana";
    }

    return "";
  };

  const safeText = (
    value: string | null | undefined
  ) => {
    return value?.trim() || "";
  };

  const handleDownloadZip = async (
  merchant: Merchant
) => {
  setDownloadingZipId(merchant.id);

  try {
    await downloadMerchantDocumentsZip({
      supabase,
      merchantId: merchant.id,
      merchantName: merchant.name || "comercio",
      merchantCuit: merchant.cuit,
    });

    toast.success(
      `Documentación de ${
        merchant.name || "comercio"
      } descargada correctamente.`
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo generar el ZIP.";

    console.error(error);
    toast.error(message);
  } finally {
    setDownloadingZipId(null);
  }
};

  const handleExport = async () => {
    if (selectedMerchants.length === 0) {
      toast.warning(
        "Seleccioná al menos un comercio para exportar."
      );
      return;
    }

    setExporting(true);

    try {
      /*
       * El archivo original de MENTA utiliza:
       *
       * Hoja 1
       * Fila 1 = grupos
       * Fila 2 = nombres de columnas
       * Fila 3 en adelante = comercios
       */

      const firstHeaderRow = [
        "Datos del comercio",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "Persona de contacto",
        "",
        "",
        "",
        "",
        "",
        "Logueo en terminal",
      ];

      const secondHeaderRow = [
        "Nombre de la empresa",
        "Entidad",
        "Razon Social",
        "CUIT",
        "Información adicional",
        "Provincia",
        "Ciudad",
        "CPA (8 dígitos) ",
        "Calle",
        "Número",
        "Piso",
        "Departamento",
        "CBU/CVU",
        "Tipo de Cuenta",
        "Condición impositiva",
        "Nombre",
        "Apellido",
        "CUIT",
        "Caracter",
        "Email",
        "Teléfono",
        "Usuario Comercio",
      ];

      const merchantRows =
        selectedMerchants.map(
          (merchant) => [
            safeText(merchant.name),

            entityLabel(
              merchant.entity_type
            ),

            safeText(
              merchant.legal_name
            ),

            safeText(merchant.cuit),

            // Información adicional:
            // se deja vacío para completar manualmente si corresponde.
            "",

            safeText(
              merchant.province
            ),

            safeText(merchant.city),

            safeText(
              merchant.postal_code
            ),

            safeText(
              merchant.street
            ),

            safeText(
              merchant.street_number
            ),

            safeText(merchant.floor),

            safeText(
              merchant.apartment
            ),

            safeText(
              merchant.bank_cbu
            ),

            safeText(
              merchant.bank_account_type
            ),

            safeText(
              merchant.tax_condition
            ),

            safeText(
              merchant.representative_first_name
            ),

            safeText(
              merchant.representative_last_name
            ),

            safeText(
              merchant.representative_cuit
            ),

            safeText(
              merchant.representative_role
            ),

            safeText(
              merchant.representative_email
            ),

            safeText(
              merchant.representative_phone
            ),

            // Usuario Comercio:
            // lo completa Panda / MENTA.
            "",
          ]
        );

      const worksheet =
        XLSX.utils.aoa_to_sheet([
          firstHeaderRow,
          secondHeaderRow,
          ...merchantRows,
        ]);

      /*
       * Mantener CUIT, CBU, CPA, teléfonos, etc.
       * como texto evita que Excel los convierta
       * automáticamente a notación científica.
       */
      const lastRow =
        merchantRows.length + 2;

      const textColumns = [
        "D", // CUIT comercio
        "H", // CPA
        "J", // número
        "K", // piso
        "L", // departamento
        "M", // CBU/CVU
        "R", // CUIT contacto
        "U", // teléfono
        "V", // usuario comercio
      ];

      textColumns.forEach((column) => {
        for (
          let row = 3;
          row <= lastRow;
          row += 1
        ) {
          const cell =
            worksheet[
              `${column}${row}`
            ];

          if (cell) {
            cell.t = "s";
          }
        }
      });

      worksheet["!cols"] = [
        { wch: 24 }, // A
        { wch: 18 }, // B
        { wch: 28 }, // C
        { wch: 16 }, // D
        { wch: 24 }, // E
        { wch: 18 }, // F
        { wch: 18 }, // G
        { wch: 16 }, // H
        { wch: 30 }, // I
        { wch: 12 }, // J
        { wch: 10 }, // K
        { wch: 15 }, // L
        { wch: 26 }, // M
        { wch: 20 }, // N
        { wch: 24 }, // O
        { wch: 20 }, // P
        { wch: 20 }, // Q
        { wch: 16 }, // R
        { wch: 18 }, // S
        { wch: 30 }, // T
        { wch: 18 }, // U
        { wch: 22 }, // V
      ];

      /*
       * Reproducimos las agrupaciones del
       * archivo original de MENTA.
       */
      worksheet["!merges"] = [
        {
          s: { r: 0, c: 0 },
          e: { r: 0, c: 14 },
        },
        {
          s: { r: 0, c: 15 },
          e: { r: 0, c: 20 },
        },
      ];

      const documentationSheet =
        XLSX.utils.aoa_to_sheet([
          [
            "Documentación: Constancia de AFIP; Comprobante de domicilio; Frente de DNI; Dorso de DNI; Foto del comercio; Selfie del responsable del comercio.",
          ],
        ]);

      documentationSheet["!cols"] = [
        { wch: 125 },
      ];

      const workbook =
        XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Hoja 1"
      );

      XLSX.utils.book_append_sheet(
        workbook,
        documentationSheet,
        "Hoja1"
      );

      const today = new Date();

      const dateText = [
        today.getFullYear(),
        String(
          today.getMonth() + 1
        ).padStart(2, "0"),
        String(today.getDate()).padStart(
          2,
          "0"
        ),
      ].join("-");

      XLSX.writeFile(
        workbook,
        `Altas_MENTA_${dateText}.xlsx`
      );

      toast.success(
        `${selectedMerchants.length} ${
          selectedMerchants.length === 1
            ? "comercio exportado"
            : "comercios exportados"
        } correctamente.`
      );
    } catch (error) {
      console.error(error);

      toast.error(
        "No se pudo generar el archivo de MENTA."
      );
    } finally {
      setExporting(false);
    }
  };

  const allVisibleSelected =
    filteredMerchants.length > 0 &&
    filteredMerchants.every(
      (merchant) =>
        selectedIds.includes(
          merchant.id
        )
    );

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 md:p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">
            Cargando comercios...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen min-w-0 overflow-x-hidden bg-slate-50 p-4 md:p-6">
      {/* ENCABEZADO */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-950 md:text-3xl">
          Altas MENTA
        </h1>

        <p className="mt-1 text-sm leading-6 text-slate-500">
          Seleccioná los comercios que querés
          informar y generá automáticamente la
          planilla de alta para MENTA.
        </p>
      </div>

      {/* RESUMEN */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Comercios registrados"
          value={String(
            merchants.length
          )}
        />

        <SummaryCard
          label="Seleccionados"
          value={String(
            selectedMerchants.length
          )}
          highlighted={
            selectedMerchants.length > 0
          }
        />

        <SummaryCard
          label="Formato"
          value="MENTA"
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* CABECERA LISTADO */}
        <div className="border-b border-slate-200 px-4 py-4 md:px-6 md:py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-slate-950 md:text-xl">
                Comercios para informar
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Los datos faltantes no bloquean la
                exportación y quedarán vacíos para
                completar manualmente.
              </p>

              <div className="mt-4 max-w-xl">
                <input
                  type="text"
                  className={inputClass}
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder="Buscar por comercio, razón social, CUIT, ciudad o provincia..."
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={selectAllVisible}
                disabled={
                  filteredMerchants.length === 0
                }
                className="w-full whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {allVisibleSelected
                  ? "Deseleccionar visibles"
                  : "Seleccionar visibles"}
              </button>

              <button
                type="button"
                onClick={clearSelection}
                disabled={
                  selectedIds.length === 0
                }
                className="w-full whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                Limpiar selección
              </button>
            </div>
          </div>
        </div>

        {/* LISTADO */}
        <div className="p-4 md:p-5">
          {filteredMerchants.length ===
          0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
              <p className="text-sm text-slate-500">
                {merchants.length === 0
                  ? "No hay comercios registrados."
                  : "No se encontraron comercios con esa búsqueda."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMerchants.map(
                (merchant) => {
                  const selected =
                    selectedIds.includes(
                      merchant.id
                    );

                  const missingFields =
                    getMissingFields(
                      merchant
                    );

                  const completedCount =
                    getCompletedCount(
                      merchant
                    );

                  const isComplete =
                    missingFields.length ===
                    0;

                  return (
                    <article
                      key={merchant.id}
                      className={`rounded-xl border p-4 transition ${
                        selected
                          ? "border-blue-300 bg-blue-50/40 shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start">
                        {/* CHECK */}
                        <button
                          type="button"
                          onClick={() =>
                            toggleMerchant(
                              merchant.id
                            )
                          }
                          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-sm font-bold transition ${
                            selected
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-slate-300 bg-white text-transparent hover:border-blue-400"
                          }`}
                          aria-label={
                            selected
                              ? "Deseleccionar comercio"
                              : "Seleccionar comercio"
                          }
                        >
                          ✓
                        </button>

                        {/* DATOS */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <h3 className="font-semibold text-slate-950">
                                {merchant.name ||
                                  "Sin nombre"}
                              </h3>

                              <p className="mt-1 text-xs text-slate-500">
                                {merchant.legal_name ||
                                  "Sin razón social"}
                              </p>
                            </div>

                            <div className="flex shrink-0 flex-wrap items-center gap-2">
                              <CompletenessBadge
                                complete={isComplete}
                                missingCount={missingFields.length}
                              />

                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleDownloadZip(merchant);
                                }}
                                disabled={downloadingZipId === merchant.id}
                                className="rounded-lg border border-[#1E3A5F]/30 bg-white px-3 py-1.5 text-xs font-semibold text-[#1E3A5F] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {downloadingZipId === merchant.id
                                  ? "Generando ZIP..."
                                  : "Descargar ZIP"}
                              </button>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                            <DataItem
                              label="CUIT"
                              value={
                                merchant.cuit ||
                                "-"
                              }
                            />

                            <DataItem
                              label="Provincia"
                              value={
                                merchant.province ||
                                "-"
                              }
                            />

                            <DataItem
                              label="Ciudad"
                              value={
                                merchant.city ||
                                "-"
                              }
                            />

                            <DataItem
                              label="CPA"
                              value={
                                merchant.postal_code ||
                                "-"
                              }
                            />
                          </div>

                          <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs text-slate-500">
                              Datos disponibles para
                              MENTA:{" "}
                              <span className="font-semibold text-slate-700">
                                {completedCount} de{" "}
                                {
                                  REQUIRED_MENTA_FIELDS.length
                                }
                              </span>
                            </p>

                            {missingFields.length >
                              0 && (
                              <details className="group">
                                <summary className="cursor-pointer text-xs font-medium text-amber-700">
                                  Ver datos faltantes
                                </summary>

                                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 sm:min-w-[260px]">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                                    Para completar
                                  </p>

                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {missingFields.map(
                                      (
                                        missing
                                      ) => (
                                        <span
                                          key={
                                            missing.field
                                          }
                                          className="rounded-md bg-white px-2 py-1 text-[11px] text-amber-800"
                                        >
                                          {
                                            missing.label
                                          }
                                        </span>
                                      )
                                    )}
                                  </div>
                                </div>
                              </details>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                }
              )}
            </div>
          )}
        </div>

        {/* ACCIONES */}
        <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur md:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-800">
                {selectedMerchants.length}{" "}
                {selectedMerchants.length ===
                1
                  ? "comercio seleccionado"
                  : "comercios seleccionados"}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Las celdas sin información se
                exportarán vacías.
              </p>
            </div>

            <button
              type="button"
              onClick={handleExport}
              disabled={
                exporting ||
                selectedMerchants.length === 0
              }
              className="w-full rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {exporting
                ? "Generando Excel..."
                : "Generar Excel MENTA"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  highlighted = false,
}: {
  label: string;
  value: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${
        highlighted
          ? "border-blue-200 bg-blue-50"
          : "border-slate-200 bg-white"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p
        className={`mt-2 text-xl font-bold ${
          highlighted
            ? "text-blue-950"
            : "text-slate-950"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function CompletenessBadge({
  complete,
  missingCount,
}: {
  complete: boolean;
  missingCount: number;
}) {
  return (
    <span
      className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
        complete
          ? "bg-emerald-100 text-emerald-700"
          : "bg-amber-100 text-amber-700"
      }`}
    >
      {complete
        ? "Datos completos"
        : `Faltan ${missingCount} ${
            missingCount === 1
              ? "dato"
              : "datos"
          }`}
    </span>
  );
}

function DataItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 break-words font-medium text-slate-700">
        {value}
      </p>
    </div>
  );
}