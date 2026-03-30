"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
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

export default function LiquidacionesComisionesClient() {
  const supabase = createClient();

  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [settings, setSettings] = useState<CommissionSetting[]>([]);
  const [targets, setTargets] = useState<CommissionTarget[]>([]);
  const [savedCommissions, setSavedCommissions] = useState<VendorCommission[]>([]);
  const [loading, setLoading] = useState(false);

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

  const loadData = async () => {
    const [vendorsRes, installationsRes, settingsRes, targetsRes, commissionsRes] =
      await Promise.all([
        supabase.from("vendors").select("id, name").order("name"),
        supabase.from("installations").select("id, vendor_id, status, install_date"),
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
      console.error("Error cargando vendedores:", vendorsRes.error.message);
    } else {
      setVendors(vendorsRes.data || []);
    }

    if (installationsRes.error) {
      console.error("Error cargando instalaciones:", installationsRes.error.message);
    } else {
      setInstallations(installationsRes.data || []);
    }

    if (settingsRes.error) {
      console.error("Error cargando configuraciones:", settingsRes.error.message);
    } else {
      setSettings(settingsRes.data || []);
    }

    if (targetsRes.error) {
      console.error("Error cargando objetivos:", targetsRes.error.message);
    } else {
      setTargets(targetsRes.data || []);
    }

    if (commissionsRes.error) {
      console.error("Error cargando liquidaciones:", commissionsRes.error.message);
    } else {
      setSavedCommissions(commissionsRes.data || []);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedSetting = useMemo(() => {
    return settings.find((s) => s.year === year && s.month === month) || null;
  }, [settings, year, month]);

  const selectedTargets = useMemo(() => {
    if (!selectedSetting) return [];
    return targets
      .filter((t) => t.commission_setting_id === selectedSetting.id)
      .sort((a, b) => a.installations_goal - b.installations_goal);
  }, [targets, selectedSetting]);

  const previewRows = useMemo<PreviewRow[]>(() => {
    if (!selectedSetting) return [];

    const filteredInstallations = installations.filter((installation) => {
      if (installation.status !== "completed") return false;
      if (!installation.vendor_id) return false;
      if (!installation.install_date) return false;

      const installDate = new Date(`${installation.install_date}T00:00:00`);
      const installYear = installDate.getFullYear();
      const installMonth = installDate.getMonth() + 1;

      return installYear === year && installMonth === month;
    });

    return vendors
      .map((vendor) => {
        const count = filteredInstallations.filter(
          (installation) => installation.vendor_id === vendor.id
        ).length;

        const baseAmount = Number(selectedSetting.base_amount_per_installation || 0);
        const baseCommission = count * baseAmount;

        const reachedTarget =
          [...selectedTargets]
            .filter((t) => count >= t.installations_goal)
            .sort((a, b) => b.installations_goal - a.installations_goal)[0] || null;

        const bonusAmount = reachedTarget ? Number(reachedTarget.bonus_amount) : 0;
        const totalAmount = baseCommission + bonusAmount;

        return {
          vendor_id: vendor.id,
          vendor_name: vendor.name || "Sin nombre",
          completed_installations: count,
          base_amount_per_installation: baseAmount,
          base_commission_amount: baseCommission,
          bonus_amount: bonusAmount,
          total_amount: totalAmount,
          reached_goal: reachedTarget
            ? `${reachedTarget.installations_goal} instalaciones`
            : "-",
        };
      })
      .filter((row) => row.completed_installations > 0)
      .sort((a, b) => b.completed_installations - a.completed_installations);
  }, [vendors, installations, selectedSetting, selectedTargets, year, month]);

  const savedRowsForPeriod = useMemo(() => {
    return savedCommissions.filter(
      (item) => item.year === year && item.month === month
    );
  }, [savedCommissions, year, month]);

  const totalInstallations = previewRows.reduce(
    (acc, row) => acc + row.completed_installations,
    0
  );

  const totalBase = previewRows.reduce(
    (acc, row) => acc + row.base_commission_amount,
    0
  );

  const totalBonus = previewRows.reduce(
    (acc, row) => acc + row.bonus_amount,
    0
  );

  const grandTotal = previewRows.reduce(
    (acc, row) => acc + row.total_amount,
    0
  );

  const handleCalculateAndSave = async () => {
    if (!selectedSetting) {
      alert("No existe una configuración de comisiones para ese período.");
      return;
    }

    if (previewRows.length === 0) {
      alert("No hay instalaciones completadas para liquidar en ese período.");
      return;
    }

    setLoading(true);

    for (const row of previewRows) {
      const payload = {
        vendor_id: row.vendor_id,
        year,
        month,
        commission_setting_id: selectedSetting.id,
        completed_installations: row.completed_installations,
        base_amount_per_installation: row.base_amount_per_installation,
        base_commission_amount: row.base_commission_amount,
        bonus_amount: row.bonus_amount,
        total_amount: row.total_amount,
        payment_status: "pending",
        notes: `Liquidación generada para ${monthLabel(month)} ${year}`,
      };

      const existing = savedCommissions.find(
        (item) =>
          item.vendor_id === row.vendor_id &&
          item.year === year &&
          item.month === month
      );

      if (existing) {
        const { error } = await supabase
          .from("vendor_commissions")
          .update(payload)
          .eq("id", existing.id);

        if (error) {
          setLoading(false);
          alert(
            `Error actualizando liquidación de ${row.vendor_name}: ${error.message}`
          );
          console.error(error);
          return;
        }
      } else {
        const { error } = await supabase
          .from("vendor_commissions")
          .insert([payload]);

        if (error) {
          setLoading(false);
          alert(
            `Error guardando liquidación de ${row.vendor_name}: ${error.message}`
          );
          console.error(error);
          return;
        }
      }
    }

    setLoading(false);
    await loadData();
    alert("Liquidación mensual guardada correctamente.");
  };

  const handleUpdatePaymentStatus = async (
    id: string,
    paymentStatus: string
  ) => {
    const { error } = await supabase
      .from("vendor_commissions")
      .update({ payment_status: paymentStatus })
      .eq("id", id);

    if (error) {
      alert(`Error actualizando estado: ${error.message}`);
      console.error(error);
      return;
    }

    await loadData();
  };

  const handleExportExcel = () => {
    if (previewRows.length === 0) {
      alert("No hay datos para exportar.");
      return;
    }

    const exportData = previewRows.map((row) => ({
      Año: year,
      Mes: monthLabel(month),
      Vendedor: row.vendor_name,
      "Instalaciones completas": row.completed_installations,
      "Monto base por instalación": row.base_amount_per_installation,
      "Comisión base": row.base_commission_amount,
      "Objetivo alcanzado": row.reached_goal,
      "Bono extra": row.bonus_amount,
      Total: row.total_amount,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Liquidación");

    XLSX.writeFile(
      workbook,
      `liquidacion_comisiones_${monthLabel(month)}_${year}.xlsx`
    );
  };

  const handlePrintPdf = () => {
    if (!selectedSetting || previewRows.length === 0) {
      alert("No hay datos para generar el reporte.");
      return;
    }

    const rowsHtml = previewRows
      .map(
        (row) => `
          <tr>
            <td>${row.vendor_name}</td>
            <td style="text-align:center;">${row.completed_installations}</td>
            <td style="text-align:right;">${formatMoney(row.base_amount_per_installation)}</td>
            <td style="text-align:right;">${formatMoney(row.base_commission_amount)}</td>
            <td style="text-align:center;">${row.reached_goal}</td>
            <td style="text-align:right;">${formatMoney(row.bonus_amount)}</td>
            <td style="text-align:right; font-weight:700;">${formatMoney(row.total_amount)}</td>
          </tr>
        `
      )
      .join("");

    const targetsHtml =
      selectedTargets.length === 0
        ? "<p>Sin objetivos cargados.</p>"
        : `
          <ul style="margin: 8px 0 0 18px; padding: 0;">
            ${selectedTargets
              .map(
                (t) =>
                  `<li>${t.installations_goal} instalaciones → ${formatMoney(
                    t.bonus_amount
                  )}</li>`
              )
              .join("")}
          </ul>
        `;

    const html = `
      <html>
        <head>
          <title>Liquidación comisiones ${monthLabel(month)} ${year}</title>
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
          <p class="muted">Período: ${monthLabel(month)} ${year}</p>

          <div class="section">
            <h3>Configuración aplicada</h3>
            <p>Monto base por instalación: <strong>${formatMoney(
              selectedSetting.base_amount_per_installation
            )}</strong></p>
            <p>Estado de configuración: <strong>${
              selectedSetting.is_active ? "Activa" : "Inactiva"
            }</strong></p>
            ${
              selectedSetting.notes
                ? `<p>Observaciones: <strong>${selectedSetting.notes}</strong></p>`
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
              <div class="value">${totalInstallations}</div>
            </div>
            <div class="card">
              <div class="label">Comisión base</div>
              <div class="value">${formatMoney(totalBase)}</div>
            </div>
            <div class="card">
              <div class="label">Bonos</div>
              <div class="value">${formatMoney(totalBonus)}</div>
            </div>
            <div class="card">
              <div class="label">Total general</div>
              <div class="value">${formatMoney(grandTotal)}</div>
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
            Reporte generado desde BENEFI - ${new Date().toLocaleString("es-AR")}
          </div>

          <script>
            window.onload = function () {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=1200,height=800");

    if (!printWindow) {
      alert("No se pudo abrir la ventana de impresión.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-3xl font-bold mb-6">Liquidación mensual de comisiones</h1>

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className="rounded-xl bg-white p-6 shadow h-fit max-h-[820px] overflow-auto">
          <h2 className="text-xl font-semibold mb-4">Parámetros</h2>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">Año</label>
                <input
                  type="number"
                  className="w-full rounded-md border px-3 py-2"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Mes</label>
                <select
                  className="w-full rounded-md border px-3 py-2"
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((monthValue) => (
                    <option key={monthValue} value={monthValue}>
                      {monthLabel(monthValue)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {!selectedSetting ? (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                No existe una configuración cargada para {monthLabel(month)} {year}.
              </div>
            ) : (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 space-y-1">
                <p>
                  Base por instalación:{" "}
                  <span className="font-semibold">
                    {formatMoney(selectedSetting.base_amount_per_installation)}
                  </span>
                </p>
                <p>
                  Estado:{" "}
                  <span className="font-semibold">
                    {selectedSetting.is_active ? "Activa" : "Inactiva"}
                  </span>
                </p>
                {selectedSetting.notes && <p>Nota: {selectedSetting.notes}</p>}
                <div className="pt-2">
                  <p className="font-semibold mb-1">Objetivos cargados:</p>
                  {selectedTargets.length === 0 ? (
                    <p className="text-slate-500">Sin objetivos.</p>
                  ) : (
                    <div className="space-y-1">
                      {selectedTargets.map((target) => (
                        <div key={target.id}>
                          {target.installations_goal} instalaciones →{" "}
                          {formatMoney(target.bonus_amount)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-slate-500">Instalaciones</p>
                <p className="text-lg font-bold">{totalInstallations}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-slate-500">Total general</p>
                <p className="text-lg font-bold">{formatMoney(grandTotal)}</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleCalculateAndSave}
                disabled={loading || !selectedSetting}
                className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
              >
                {loading ? "Procesando..." : "Calcular y guardar liquidación"}
              </button>

              <button
                type="button"
                onClick={handleExportExcel}
                className="rounded-md bg-emerald-600 px-4 py-2 text-white"
              >
                Exportar Excel
              </button>

              <button
                type="button"
                onClick={handlePrintPdf}
                className="rounded-md bg-blue-600 px-4 py-2 text-white"
              >
                Generar PDF / Imprimir
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-xl bg-white p-6 shadow flex flex-col min-h-[820px]">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Vista previa de liquidación</h2>
            <p className="text-sm text-slate-500">
              Período: {monthLabel(month)} {year}
            </p>
          </div>

          {previewRows.length === 0 ? (
            <p className="text-slate-500">
              {selectedSetting
                ? "No hay instalaciones completas para liquidar en este período."
                : "Primero necesitás una configuración mensual para este período."}
            </p>
          ) : (
            <div className="overflow-auto max-h-[360px] border rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-slate-100">
                  <tr className="text-left">
                    <th className="px-4 py-3">Vendedor</th>
                    <th className="px-4 py-3">Instalaciones</th>
                    <th className="px-4 py-3">Base</th>
                    <th className="px-4 py-3">Comisión base</th>
                    <th className="px-4 py-3">Objetivo</th>
                    <th className="px-4 py-3">Bono</th>
                    <th className="px-4 py-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => (
                    <tr key={row.vendor_id} className="border-t">
                      <td className="px-4 py-3">{row.vendor_name}</td>
                      <td className="px-4 py-3">{row.completed_installations}</td>
                      <td className="px-4 py-3">
                        {formatMoney(row.base_amount_per_installation)}
                      </td>
                      <td className="px-4 py-3">
                        {formatMoney(row.base_commission_amount)}
                      </td>
                      <td className="px-4 py-3">{row.reached_goal}</td>
                      <td className="px-4 py-3">
                        {formatMoney(row.bonus_amount)}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {formatMoney(row.total_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-8 flex-1 min-h-0">
            <h3 className="text-lg font-semibold mb-3">
              Liquidaciones guardadas del período
            </h3>

            {savedRowsForPeriod.length === 0 ? (
              <p className="text-slate-500">
                Todavía no hay liquidaciones guardadas para este período.
              </p>
            ) : (
              <div className="overflow-auto max-h-[320px] border rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-slate-100">
                    <tr className="text-left">
                      <th className="px-4 py-3">Vendedor</th>
                      <th className="px-4 py-3">Instalaciones</th>
                      <th className="px-4 py-3">Base</th>
                      <th className="px-4 py-3">Bono</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">Estado pago</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedRowsForPeriod.map((item) => {
                      const vendorName =
                        vendors.find((v) => v.id === item.vendor_id)?.name ||
                        "Sin nombre";

                      return (
                        <tr key={item.id} className="border-t">
                          <td className="px-4 py-3">{vendorName}</td>
                          <td className="px-4 py-3">
                            {item.completed_installations}
                          </td>
                          <td className="px-4 py-3">
                            {formatMoney(item.base_commission_amount)}
                          </td>
                          <td className="px-4 py-3">
                            {formatMoney(item.bonus_amount)}
                          </td>
                          <td className="px-4 py-3 font-semibold">
                            {formatMoney(item.total_amount)}
                          </td>
                          <td className="px-4 py-3">
                            <select
                              className="rounded-md border px-2 py-1"
                              value={item.payment_status}
                              onChange={(e) =>
                                handleUpdatePaymentStatus(item.id, e.target.value)
                              }
                            >
                              <option value="pending">Pendiente</option>
                              <option value="paid">Pagado</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}