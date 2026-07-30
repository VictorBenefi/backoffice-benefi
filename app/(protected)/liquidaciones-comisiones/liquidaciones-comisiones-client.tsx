"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

type Vendor = {
  id: string;
  name: string | null;
};

type Installation = {
  id: string;
  vendor_id: string | null;
  status: string;
  install_date: string | null;
};

type CommissionSetting = {
  id: string;
  year: number;
  month: number;
  base_amount_per_installation: number;
  notes: string | null;
  is_active: boolean;
};

type CommissionTarget = {
  id: string;
  commission_setting_id: string;
  installations_goal: number;
  bonus_amount: number;
};

type VendorCommission = {
  id: string;
  vendor_id: string;
  year: number;
  month: number;
  commission_setting_id: string | null;
  completed_installations: number;
  base_amount_per_installation: number;
  base_commission_amount: number;
  bonus_amount: number;
  total_amount: number;
  payment_status: string;
  notes: string | null;
  status: string | null;
  closed_at: string | null;
  created_at: string;
};

type PreviewRow = {
  vendor_id: string;
  vendor_name: string;
  completed_installations: number;
  base_amount_per_installation: number;
  base_commission_amount: number;
  bonus_amount: number;
  total_amount: number;
  reached_goal: string;
};

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";

export default function LiquidacionesComisionesClient() {
  const supabase = useMemo(() => createClient(), []);
  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [settings, setSettings] = useState<CommissionSetting[]>([]);
  const [targets, setTargets] = useState<CommissionTarget[]>([]);
  const [savedCommissions, setSavedCommissions] = useState<
    VendorCommission[]
  >([]);

  const [loadingData, setLoadingData] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [closing, setClosing] = useState(false);
  const [updatingPaymentId, setUpdatingPaymentId] = useState<string | null>(
    null
  );
  const [showCloseModal, setShowCloseModal] = useState(false);

  const monthLabel = (monthValue: number) => {
    const months = [
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ];

    return months[monthValue - 1] || `Mes ${monthValue}`;
  };

  const formatMoney = (value: number | string | null) => {
    const numberValue = Number(value || 0);

    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 2,
    }).format(numberValue);
  };

  async function loadData() {
    setLoadingData(true);

    const [
      vendorsRes,
      installationsRes,
      settingsRes,
      targetsRes,
      commissionsRes,
    ] = await Promise.all([
      supabase.from("vendors").select("id, name").order("name"),
      supabase
        .from("installations")
        .select("id, vendor_id, status, install_date"),
      supabase
        .from("commission_settings")
        .select("*")
        .order("year", { ascending: false })
        .order("month", { ascending: false }),
      supabase
        .from("commission_targets")
        .select("*")
        .order("installations_goal", { ascending: true }),
      supabase
        .from("vendor_commissions")
        .select("*")
        .order("year", { ascending: false })
        .order("month", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

    if (vendorsRes.error) {
      console.error(vendorsRes.error);
      toast.error(`Error cargando vendedores: ${vendorsRes.error.message}`);
      setVendors([]);
    } else {
      setVendors(vendorsRes.data || []);
    }

    if (installationsRes.error) {
      console.error(installationsRes.error);
      toast.error(
        `Error cargando instalaciones: ${installationsRes.error.message}`
      );
      setInstallations([]);
    } else {
      setInstallations(installationsRes.data || []);
    }

    if (settingsRes.error) {
      console.error(settingsRes.error);
      toast.error(
        `Error cargando configuraciones: ${settingsRes.error.message}`
      );
      setSettings([]);
    } else {
      setSettings(settingsRes.data || []);
    }

    if (targetsRes.error) {
      console.error(targetsRes.error);
      toast.error(`Error cargando objetivos: ${targetsRes.error.message}`);
      setTargets([]);
    } else {
      setTargets(targetsRes.data || []);
    }

    if (commissionsRes.error) {
      console.error(commissionsRes.error);
      toast.error(
        `Error cargando liquidaciones: ${commissionsRes.error.message}`
      );
      setSavedCommissions([]);
    } else {
      setSavedCommissions(commissionsRes.data || []);
    }

    setLoadingData(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const selectedSetting = useMemo(() => {
    return (
      settings.find(
        (setting) =>
          Number(setting.year) === Number(year) &&
          Number(setting.month) === Number(month)
      ) || null
    );
  }, [settings, year, month]);

  const selectedTargets = useMemo(() => {
    if (!selectedSetting) return [];

    return targets
      .filter(
        (target) =>
          target.commission_setting_id === selectedSetting.id
      )
      .sort(
        (a, b) =>
          a.installations_goal - b.installations_goal
      );
  }, [targets, selectedSetting]);

  const previewRows = useMemo<PreviewRow[]>(() => {
    if (!selectedSetting) return [];

    const filteredInstallations = installations.filter((installation) => {
      if (installation.status !== "completed") return false;
      if (!installation.vendor_id) return false;
      if (!installation.install_date) return false;

      const installDate = new Date(
        `${installation.install_date}T00:00:00`
      );

      return (
        installDate.getFullYear() === Number(year) &&
        installDate.getMonth() + 1 === Number(month)
      );
    });

    return vendors
      .map((vendor) => {
        const completedInstallations = filteredInstallations.filter(
          (installation) => installation.vendor_id === vendor.id
        ).length;

        const baseAmount = Number(
          selectedSetting.base_amount_per_installation || 0
        );

        const baseCommission =
          completedInstallations * baseAmount;

        const reachedTarget =
          [...selectedTargets]
            .filter(
              (target) =>
                completedInstallations >= target.installations_goal
            )
            .sort(
              (a, b) =>
                b.installations_goal - a.installations_goal
            )[0] || null;

        const bonusAmount = reachedTarget
          ? Number(reachedTarget.bonus_amount)
          : 0;

        return {
          vendor_id: vendor.id,
          vendor_name: vendor.name || "Sin nombre",
          completed_installations: completedInstallations,
          base_amount_per_installation: baseAmount,
          base_commission_amount: baseCommission,
          bonus_amount: bonusAmount,
          total_amount: baseCommission + bonusAmount,
          reached_goal: reachedTarget
            ? `${reachedTarget.installations_goal} instalaciones`
            : "Sin objetivo",
        };
      })
      .filter((row) => row.completed_installations > 0)
      .sort(
        (a, b) =>
          b.completed_installations - a.completed_installations
      );
  }, [
    vendors,
    installations,
    selectedSetting,
    selectedTargets,
    year,
    month,
  ]);

  const savedRowsForPeriod = useMemo(() => {
    return savedCommissions.filter(
      (item) =>
        Number(item.year) === Number(year) &&
        Number(item.month) === Number(month)
    );
  }, [savedCommissions, year, month]);

  const isPeriodClosed = useMemo(() => {
    return savedRowsForPeriod.some(
      (item) => item.status === "closed"
    );
  }, [savedRowsForPeriod]);

  const totalInstallations = previewRows.reduce(
    (total, row) => total + row.completed_installations,
    0
  );

  const totalBase = previewRows.reduce(
    (total, row) => total + row.base_commission_amount,
    0
  );

  const totalBonus = previewRows.reduce(
    (total, row) => total + row.bonus_amount,
    0
  );

  const grandTotal = previewRows.reduce(
    (total, row) => total + row.total_amount,
    0
  );

  async function handleCalculateAndSave() {
    if (!selectedSetting) {
      toast.warning(
        "No existe una configuración de comisiones para ese período."
      );
      return;
    }

    if (isPeriodClosed) {
      toast.warning(
        "La liquidación está cerrada y no puede recalcularse."
      );
      return;
    }

    setCalculating(true);

    try {
      const response = await fetch(
        "/api/commissions/liquidate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ year, month }),
        }
      );

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "No se pudo liquidar el período."
        );
      }

      await loadData();

      toast.success(
        "Liquidación mensual guardada correctamente."
      );
    } catch (error) {
      console.error(error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Ocurrió un error al guardar la liquidación."
      );
    } finally {
      setCalculating(false);
    }
  }

  function requestCloseLiquidation() {
    if (savedRowsForPeriod.length === 0) {
      toast.warning(
        "Primero debés guardar la liquidación antes de cerrarla."
      );
      return;
    }

    if (isPeriodClosed) {
      toast.info(
        "La liquidación de este período ya está cerrada."
      );
      return;
    }

    setShowCloseModal(true);
  }

  async function handleCloseLiquidation() {
    setClosing(true);

    try {
      const response = await fetch(
        "/api/commissions/close",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ year, month }),
        }
      );

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "No se pudo cerrar la liquidación."
        );
      }

      await loadData();

      setShowCloseModal(false);

      toast.success(
        "Liquidación cerrada correctamente."
      );
    } catch (error) {
      console.error(error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Ocurrió un error al cerrar la liquidación."
      );
    } finally {
      setClosing(false);
    }
  }

  async function handleUpdatePaymentStatus(
    id: string,
    paymentStatus: string
  ) {
    setUpdatingPaymentId(id);

    const { error } = await supabase
      .from("vendor_commissions")
      .update({ payment_status: paymentStatus })
      .eq("id", id);

    setUpdatingPaymentId(null);

    if (error) {
      console.error(error);
      toast.error(
        `Error actualizando estado: ${error.message}`
      );
      return;
    }

    setSavedCommissions((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              payment_status: paymentStatus,
            }
          : item
      )
    );

    toast.success(
      paymentStatus === "paid"
        ? "Comisión marcada como pagada."
        : "Comisión marcada como pendiente."
    );
  }

  function handleExportExcel() {
    if (previewRows.length === 0) {
      toast.warning("No hay datos para exportar.");
      return;
    }

    const exportData = previewRows.map((row) => ({
      Año: year,
      Mes: monthLabel(month),
      Vendedor: row.vendor_name,
      "Instalaciones completas":
        row.completed_installations,
      "Monto base por instalación":
        row.base_amount_per_installation,
      "Comisión base":
        row.base_commission_amount,
      "Objetivo alcanzado": row.reached_goal,
      "Bono extra": row.bonus_amount,
      Total: row.total_amount,
      Estado: isPeriodClosed
        ? "Cerrada"
        : "Borrador",
    }));

    const worksheet =
      XLSX.utils.json_to_sheet(exportData);

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Liquidación"
    );

    XLSX.writeFile(
      workbook,
      `liquidacion_comisiones_${monthLabel(month)}_${year}.xlsx`
    );

    toast.success("Archivo Excel generado correctamente.");
  }

  function handlePrintPdf() {
    if (!selectedSetting || previewRows.length === 0) {
      toast.warning(
        "No hay datos para generar el reporte."
      );
      return;
    }

    const rowsHtml = previewRows
      .map(
        (row) => `
          <tr>
            <td>${row.vendor_name}</td>
            <td style="text-align:center;">
              ${row.completed_installations}
            </td>
            <td style="text-align:right;">
              ${formatMoney(row.base_amount_per_installation)}
            </td>
            <td style="text-align:right;">
              ${formatMoney(row.base_commission_amount)}
            </td>
            <td style="text-align:center;">
              ${row.reached_goal}
            </td>
            <td style="text-align:right;">
              ${formatMoney(row.bonus_amount)}
            </td>
            <td style="text-align:right;font-weight:700;">
              ${formatMoney(row.total_amount)}
            </td>
          </tr>
        `
      )
      .join("");

    const targetsHtml =
      selectedTargets.length === 0
        ? "<p>Sin objetivos cargados.</p>"
        : `
          <ul style="margin:8px 0 0 18px;padding:0;">
            ${selectedTargets
              .map(
                (target) =>
                  `<li>
                    ${target.installations_goal} instalaciones →
                    ${formatMoney(target.bonus_amount)}
                  </li>`
              )
              .join("")}
          </ul>
        `;

    const html = `
      <html>
        <head>
          <title>
            Liquidación comisiones ${monthLabel(month)} ${year}
          </title>

          <style>
            body {
              font-family: Arial, sans-serif;
              color: #111827;
              margin: 32px;
            }

            h1, h2, h3 {
              margin: 0 0 12px 0;
            }

            .muted {
              color: #6b7280;
              font-size: 12px;
            }

            .section {
              margin-top: 24px;
            }

            .summary {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 12px;
              margin-top: 16px;
              margin-bottom: 24px;
            }

            .card {
              border: 1px solid #d1d5db;
              border-radius: 8px;
              padding: 12px;
            }

            .card .label {
              font-size: 12px;
              color: #6b7280;
              margin-bottom: 6px;
            }

            .card .value {
              font-size: 18px;
              font-weight: 700;
            }

            .status {
              display: inline-block;
              padding: 4px 10px;
              border-radius: 999px;
              font-size: 12px;
              font-weight: 700;
              background: ${
                isPeriodClosed
                  ? "#dcfce7"
                  : "#fef3c7"
              };
              color: ${
                isPeriodClosed
                  ? "#166534"
                  : "#92400e"
              };
            }

            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 12px;
            }

            th, td {
              border: 1px solid #d1d5db;
              padding: 8px;
              font-size: 12px;
            }

            th {
              background: #f3f4f6;
              text-align: left;
            }

            .footer {
              margin-top: 30px;
              font-size: 12px;
              color: #6b7280;
            }

            @media print {
              body {
                margin: 20px;
              }
            }
          </style>
        </head>

        <body>
          <h1>Liquidación mensual de comisiones</h1>

          <p class="muted">
            Período: ${monthLabel(month)} ${year}
          </p>

          <p>
            <span class="status">
              ${isPeriodClosed ? "CERRADA" : "BORRADOR"}
            </span>
          </p>

          <div class="section">
            <h3>Configuración aplicada</h3>

            <p>
              Monto base por instalación:
              <strong>
                ${formatMoney(
                  selectedSetting.base_amount_per_installation
                )}
              </strong>
            </p>

            <p>
              Estado de configuración:
              <strong>
                ${
                  selectedSetting.is_active
                    ? "Activa"
                    : "Inactiva"
                }
              </strong>
            </p>

            ${
              selectedSetting.notes
                ? `
                  <p>
                    Observaciones:
                    <strong>
                      ${selectedSetting.notes}
                    </strong>
                  </p>
                `
                : ""
            }
          </div>

          <div class="section">
            <h3>Objetivos del período</h3>
            ${targetsHtml}
          </div>

          <div class="summary">
            <div class="card">
              <div class="label">Instalaciones</div>
              <div class="value">
                ${totalInstallations}
              </div>
            </div>

            <div class="card">
              <div class="label">Comisión base</div>
              <div class="value">
                ${formatMoney(totalBase)}
              </div>
            </div>

            <div class="card">
              <div class="label">Bonos</div>
              <div class="value">
                ${formatMoney(totalBonus)}
              </div>
            </div>

            <div class="card">
              <div class="label">Total general</div>
              <div class="value">
                ${formatMoney(grandTotal)}
              </div>
            </div>
          </div>

          <div class="section">
            <h3>Detalle por vendedor</h3>

            <table>
              <thead>
                <tr>
                  <th>Vendedor</th>
                  <th>Instalaciones</th>
                  <th>Base x instalación</th>
                  <th>Comisión base</th>
                  <th>Objetivo</th>
                  <th>Bono</th>
                  <th>Total</th>
                </tr>
              </thead>

              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>

          <div class="footer">
            Reporte generado desde BENEFI -
            ${new Date().toLocaleString("es-AR")}
          </div>

          <script>
            window.onload = function () {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    const printWindow = window.open(
      "",
      "_blank",
      "width=1200,height=800"
    );

    if (!printWindow) {
      toast.error(
        "No se pudo abrir la ventana de impresión."
      );
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }

  if (loadingData) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 md:p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">
            Cargando liquidaciones...
          </p>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="min-h-screen min-w-0 overflow-x-hidden bg-slate-50 p-4 md:p-6">
        <div className="mb-5 md:mb-6">
          <h1 className="text-2xl font-bold text-slate-950 md:text-3xl">
            Liquidación de comisiones
          </h1>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Calculá, guardá y cerrá las comisiones mensuales
            correspondientes a cada vendedor.
          </p>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Instalaciones"
            value={String(totalInstallations)}
          />

          <MetricCard
            label="Comisión base"
            value={formatMoney(totalBase)}
          />

          <MetricCard
            label="Bonos"
            value={formatMoney(totalBonus)}
          />

          <MetricCard
            label="Total general"
            value={formatMoney(grandTotal)}
            highlighted
          />
        </div>

        <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-6">
            <div className="border-b border-slate-200 px-4 py-4 md:px-5 md:py-5">
              <h2 className="text-lg font-semibold text-slate-950">
                Período y configuración
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                Seleccioná el período que querés liquidar.
              </p>
            </div>

            <div className="space-y-5 px-4 py-5 md:px-5">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Año">
                  <input
                    type="number"
                    className={inputClass}
                    value={year}
                    onChange={(event) =>
                      setYear(Number(event.target.value))
                    }
                  />
                </Field>

                <Field label="Mes">
                  <select
                    className={inputClass}
                    value={month}
                    onChange={(event) =>
                      setMonth(Number(event.target.value))
                    }
                  >
                    {Array.from(
                      { length: 12 },
                      (_, index) => index + 1
                    ).map((monthValue) => (
                      <option
                        key={monthValue}
                        value={monthValue}
                      >
                        {monthLabel(monthValue)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              {!selectedSetting ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <p className="text-sm font-medium text-rose-800">
                    Configuración no disponible
                  </p>

                  <p className="mt-1 text-xs leading-5 text-rose-700">
                    No existe una configuración de comisiones para{" "}
                    {monthLabel(month)} {year}.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Base por instalación
                      </p>

                      <p className="mt-1 text-lg font-bold text-slate-950">
                        {formatMoney(
                          selectedSetting.base_amount_per_installation
                        )}
                      </p>
                    </div>

                    <ConfigurationBadge
                      active={selectedSetting.is_active}
                    />
                  </div>

                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Estado de la liquidación
                    </p>

                    <div className="mt-2">
                      <LiquidationStatusBadge
                        closed={isPeriodClosed}
                      />
                    </div>
                  </div>

                  {selectedSetting.notes && (
                    <div className="mt-4 border-t border-slate-200 pt-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Observaciones
                      </p>

                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {selectedSetting.notes}
                      </p>
                    </div>
                  )}

                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Objetivos
                    </p>

                    {selectedTargets.length === 0 ? (
                      <p className="mt-2 text-sm text-slate-500">
                        Sin objetivos cargados.
                      </p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {selectedTargets.map((target) => (
                          <div
                            key={target.id}
                            className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2"
                          >
                            <span className="text-sm text-slate-600">
                              {target.installations_goal} instalaciones
                            </span>

                            <span className="text-sm font-semibold text-slate-950">
                              {formatMoney(target.bonus_amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 border-t border-slate-200 bg-slate-50 px-4 py-4 md:px-5">
              <button
                type="button"
                onClick={handleCalculateAndSave}
                disabled={
                  calculating ||
                  !selectedSetting ||
                  isPeriodClosed
                }
                className="w-full rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {calculating
                  ? "Procesando..."
                  : isPeriodClosed
                    ? "Liquidación cerrada"
                    : "Calcular y guardar"}
              </button>

              <button
                type="button"
                onClick={requestCloseLiquidation}
                disabled={
                  closing ||
                  savedRowsForPeriod.length === 0 ||
                  isPeriodClosed
                }
                className="w-full rounded-lg border border-rose-200 bg-white px-4 py-2.5 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPeriodClosed
                  ? "Liquidación cerrada"
                  : "Cerrar liquidación"}
              </button>

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="w-full rounded-lg border border-emerald-200 bg-white px-4 py-2.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50"
                >
                  Exportar Excel
                </button>

                <button
                  type="button"
                  onClick={handlePrintPdf}
                  className="w-full rounded-lg border border-blue-200 bg-white px-4 py-2.5 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
                >
                  Generar PDF / Imprimir
                </button>
              </div>
            </div>
          </section>

          <div className="min-w-0 space-y-6">
            <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <SectionHeader
                title="Vista previa de liquidación"
                description={`Período: ${monthLabel(month)} ${year}`}
                badge={`${previewRows.length} vendedores`}
              />

              {previewRows.length === 0 ? (
                <EmptyState
                  message={
                    selectedSetting
                      ? "No hay instalaciones completas para liquidar en este período."
                      : "Primero necesitás una configuración mensual para este período."
                  }
                />
              ) : (
                <>
                  <div className="space-y-3 p-4 md:hidden">
                    {previewRows.map((row) => (
                      <PreviewMobileCard
                        key={row.vendor_id}
                        row={row}
                        formatMoney={formatMoney}
                      />
                    ))}
                  </div>

                  <div className="hidden overflow-x-auto md:block">
                    <table className="min-w-[860px] w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr className="border-b border-slate-200 text-left">
                          <th className="px-4 py-3 font-medium text-slate-600">
                            Vendedor
                          </th>
                          <th className="px-4 py-3 font-medium text-slate-600">
                            Instalaciones
                          </th>
                          <th className="px-4 py-3 font-medium text-slate-600">
                            Base
                          </th>
                          <th className="px-4 py-3 font-medium text-slate-600">
                            Comisión base
                          </th>
                          <th className="px-4 py-3 font-medium text-slate-600">
                            Objetivo
                          </th>
                          <th className="px-4 py-3 font-medium text-slate-600">
                            Bono
                          </th>
                          <th className="px-4 py-3 font-medium text-slate-600">
                            Total
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {previewRows.map((row) => (
                          <tr
                            key={row.vendor_id}
                            className="border-b border-slate-100 last:border-b-0"
                          >
                            <td className="px-4 py-3 font-medium text-slate-950">
                              {row.vendor_name}
                            </td>

                            <td className="px-4 py-3 text-slate-600">
                              {row.completed_installations}
                            </td>

                            <td className="px-4 py-3 text-slate-600">
                              {formatMoney(
                                row.base_amount_per_installation
                              )}
                            </td>

                            <td className="px-4 py-3 text-slate-600">
                              {formatMoney(
                                row.base_commission_amount
                              )}
                            </td>

                            <td className="px-4 py-3 text-slate-600">
                              {row.reached_goal}
                            </td>

                            <td className="px-4 py-3 text-slate-600">
                              {formatMoney(row.bonus_amount)}
                            </td>

                            <td className="px-4 py-3 font-semibold text-slate-950">
                              {formatMoney(row.total_amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>

            <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <SectionHeader
                title="Liquidaciones guardadas"
                description={`Registros guardados para ${monthLabel(month)} ${year}`}
                badge={`${savedRowsForPeriod.length} registros`}
              />

              {savedRowsForPeriod.length === 0 ? (
                <EmptyState message="Todavía no hay liquidaciones guardadas para este período." />
              ) : (
                <>
                  <div className="space-y-3 p-4 md:hidden">
                    {savedRowsForPeriod.map((item) => {
                      const vendorName =
                        vendors.find(
                          (vendor) =>
                            vendor.id === item.vendor_id
                        )?.name || "Sin nombre";

                      return (
                        <SavedCommissionMobileCard
                          key={item.id}
                          item={item}
                          vendorName={vendorName}
                          formatMoney={formatMoney}
                          updating={
                            updatingPaymentId === item.id
                          }
                          onPaymentChange={(status) =>
                            handleUpdatePaymentStatus(
                              item.id,
                              status
                            )
                          }
                        />
                      );
                    })}
                  </div>

                  <div className="hidden overflow-x-auto md:block">
                    <table className="min-w-[820px] w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr className="border-b border-slate-200 text-left">
                          <th className="px-4 py-3 font-medium text-slate-600">
                            Vendedor
                          </th>
                          <th className="px-4 py-3 font-medium text-slate-600">
                            Instalaciones
                          </th>
                          <th className="px-4 py-3 font-medium text-slate-600">
                            Base
                          </th>
                          <th className="px-4 py-3 font-medium text-slate-600">
                            Bono
                          </th>
                          <th className="px-4 py-3 font-medium text-slate-600">
                            Total
                          </th>
                          <th className="px-4 py-3 font-medium text-slate-600">
                            Estado
                          </th>
                          <th className="px-4 py-3 font-medium text-slate-600">
                            Estado de pago
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {savedRowsForPeriod.map((item) => {
                          const vendorName =
                            vendors.find(
                              (vendor) =>
                                vendor.id === item.vendor_id
                            )?.name || "Sin nombre";

                          return (
                            <tr
                              key={item.id}
                              className="border-b border-slate-100 last:border-b-0"
                            >
                              <td className="px-4 py-3 font-medium text-slate-950">
                                {vendorName}
                              </td>

                              <td className="px-4 py-3 text-slate-600">
                                {item.completed_installations}
                              </td>

                              <td className="px-4 py-3 text-slate-600">
                                {formatMoney(
                                  item.base_commission_amount
                                )}
                              </td>

                              <td className="px-4 py-3 text-slate-600">
                                {formatMoney(item.bonus_amount)}
                              </td>

                              <td className="px-4 py-3 font-semibold text-slate-950">
                                {formatMoney(item.total_amount)}
                              </td>

                              <td className="px-4 py-3">
                                <LiquidationStatusBadge
                                  closed={
                                    item.status === "closed"
                                  }
                                />
                              </td>

                              <td className="px-4 py-3">
                                <select
                                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-950"
                                  value={item.payment_status}
                                  disabled={
                                    updatingPaymentId === item.id
                                  }
                                  onChange={(event) =>
                                    handleUpdatePaymentStatus(
                                      item.id,
                                      event.target.value
                                    )
                                  }
                                >
                                  <option value="pending">
                                    Pendiente
                                  </option>
                                  <option value="paid">
                                    Pagado
                                  </option>
                                </select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      </main>

      {showCloseModal && (
        <CloseLiquidationModal
          period={`${monthLabel(month)} ${year}`}
          loading={closing}
          onCancel={() => setShowCloseModal(false)}
          onConfirm={handleCloseLiquidation}
        />
      )}
    </>
  );
}

function MetricCard({
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
        className={`mt-2 break-words text-xl font-bold md:text-2xl ${
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>

      {children}
    </div>
  );
}

function SectionHeader({
  title,
  description,
  badge,
}: {
  title: string;
  description: string;
  badge: string;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-start sm:justify-between md:px-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">
          {title}
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          {description}
        </p>
      </div>

      <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
        {badge}
      </span>
    </div>
  );
}

function EmptyState({
  message,
}: {
  message: string;
}) {
  return (
    <div className="p-4">
      <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
        <p className="text-sm leading-6 text-slate-500">
          {message}
        </p>
      </div>
    </div>
  );
}

function ConfigurationBadge({
  active,
}: {
  active: boolean;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
        active
          ? "bg-emerald-100 text-emerald-700"
          : "bg-slate-200 text-slate-700"
      }`}
    >
      {active ? "Activa" : "Inactiva"}
    </span>
  );
}

function LiquidationStatusBadge({
  closed,
}: {
  closed: boolean;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
        closed
          ? "bg-emerald-100 text-emerald-700"
          : "bg-amber-100 text-amber-700"
      }`}
    >
      {closed ? "Cerrada" : "Borrador"}
    </span>
  );
}

function PreviewMobileCard({
  row,
  formatMoney,
}: {
  row: PreviewRow;
  formatMoney: (
    value: number | string | null
  ) => string;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950">
            {row.vendor_name}
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            {row.completed_installations} instalaciones
          </p>
        </div>

        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
          {row.reached_goal}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <MobileValue
          label="Base por instalación"
          value={formatMoney(
            row.base_amount_per_installation
          )}
        />

        <MobileValue
          label="Comisión base"
          value={formatMoney(
            row.base_commission_amount
          )}
        />

        <MobileValue
          label="Bono"
          value={formatMoney(row.bonus_amount)}
        />

        <MobileValue
          label="Total"
          value={formatMoney(row.total_amount)}
          highlighted
        />
      </div>
    </article>
  );
}

function SavedCommissionMobileCard({
  item,
  vendorName,
  formatMoney,
  updating,
  onPaymentChange,
}: {
  item: VendorCommission;
  vendorName: string;
  formatMoney: (
    value: number | string | null
  ) => string;
  updating: boolean;
  onPaymentChange: (status: string) => void;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950">
            {vendorName}
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            {item.completed_installations} instalaciones
          </p>
        </div>

        <LiquidationStatusBadge
          closed={item.status === "closed"}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <MobileValue
          label="Comisión base"
          value={formatMoney(
            item.base_commission_amount
          )}
        />

        <MobileValue
          label="Bono"
          value={formatMoney(item.bonus_amount)}
        />

        <div className="col-span-2">
          <MobileValue
            label="Total"
            value={formatMoney(item.total_amount)}
            highlighted
          />
        </div>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          Estado de pago
        </label>

        <select
          className={inputClass}
          value={item.payment_status}
          disabled={updating}
          onChange={(event) =>
            onPaymentChange(event.target.value)
          }
        >
          <option value="pending">
            Pendiente
          </option>

          <option value="paid">
            Pagado
          </option>
        </select>
      </div>
    </article>
  );
}

function MobileValue({
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
      className={`rounded-lg p-3 ${
        highlighted
          ? "bg-blue-50"
          : "bg-slate-50"
      }`}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p
        className={`mt-1 break-words text-sm font-semibold ${
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

function CloseLiquidationModal({
  period,
  loading,
  onCancel,
  onConfirm,
}: {
  period: string;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-950">
            Cerrar liquidación
          </h3>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Esta acción dejará el período bloqueado para nuevos cálculos.
          </p>
        </div>

        <div className="px-5 py-5">
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm font-semibold text-rose-900">
              Período: {period}
            </p>

            <p className="mt-2 text-sm leading-6 text-rose-700">
              Después de cerrar la liquidación no podrá recalcularse ni
              modificarse automáticamente.
            </p>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="w-full rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {loading
              ? "Cerrando..."
              : "Confirmar cierre"}
          </button>
        </div>
      </div>
    </div>
  );
}