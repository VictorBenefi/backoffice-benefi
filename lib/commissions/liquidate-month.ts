import { createAdminClient } from "@/lib/supabase/admin";

type LiquidateMonthParams = {
  year: number;
  month: number;
};

export async function liquidateMonth({
  year,
  month,
}: LiquidateMonthParams) {
  const supabase = createAdminClient();

  // 1) Si existe alguna liquidación cerrada para el período, bloquear recálculo
  const { data: existingRows, error: existingRowsError } = await supabase
    .from("vendor_commissions")
    .select("id, status")
    .eq("year", year)
    .eq("month", month);

  if (existingRowsError) {
    throw new Error(
      `Error verificando liquidaciones existentes: ${existingRowsError.message}`
    );
  }

  const isClosed = (existingRows || []).some(
    (row) => row.status === "closed"
  );

  if (isClosed) {
    throw new Error("La liquidación de este período está cerrada y no puede recalcularse.");
  }

  // 2) Buscar configuración del período
  const { data: setting, error: settingError } = await supabase
    .from("commission_settings")
    .select("id, year, month, base_amount_per_installation")
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  if (settingError) {
    throw new Error(
      `Error buscando configuración de comisión: ${settingError.message}`
    );
  }

  if (!setting) {
    throw new Error(`No existe configuración de comisiones para ${month}/${year}`);
  }

  // 3) Buscar objetivos del período
  const { data: targets, error: targetsError } = await supabase
    .from("commission_targets")
    .select("id, commission_setting_id, installations_goal, bonus_amount")
    .eq("commission_setting_id", setting.id)
    .order("installations_goal", { ascending: true });

  if (targetsError) {
    throw new Error(`Error buscando objetivos: ${targetsError.message}`);
  }

  // 4) Traer vendedores
  const { data: vendors, error: vendorsError } = await supabase
    .from("vendors")
    .select("id, name")
    .order("name", { ascending: true });

  if (vendorsError) {
    throw new Error(`Error buscando vendedores: ${vendorsError.message}`);
  }

  // 5) Traer instalaciones completed
  const { data: installations, error: installationsError } = await supabase
    .from("installations")
    .select("id, vendor_id, status, install_date")
    .eq("status", "completed");

  if (installationsError) {
    throw new Error(`Error buscando instalaciones: ${installationsError.message}`);
  }

  // 6) Filtrar instalaciones del período
  const filteredInstallations = (installations || []).filter((installation) => {
    if (!installation.vendor_id) return false;
    if (!installation.install_date) return false;

    const installDate = new Date(`${installation.install_date}T00:00:00`);
    const installYear = installDate.getFullYear();
    const installMonth = installDate.getMonth() + 1;

    return installYear === year && installMonth === month;
  });

  // 7) Contar instalaciones por vendedor
  const installationCountByVendor = new Map<string, number>();

  for (const row of filteredInstallations) {
    const vendorId = row.vendor_id;
    if (!vendorId) continue;

    installationCountByVendor.set(
      vendorId,
      (installationCountByVendor.get(vendorId) || 0) + 1
    );
  }

  // 8) Preparar filas para guardar
  const nowIso = new Date().toISOString();

  const rows = (vendors || [])
    .map((vendor) => {
      const completedInstallations =
        installationCountByVendor.get(vendor.id) || 0;

      if (completedInstallations <= 0) return null;

      const baseAmount = Number(setting.base_amount_per_installation || 0);
      const baseCommissionAmount = completedInstallations * baseAmount;

      const reachedTarget =
        [...(targets || [])]
          .filter(
            (target) =>
              completedInstallations >= Number(target.installations_goal || 0)
          )
          .sort(
            (a, b) =>
              Number(b.installations_goal || 0) -
              Number(a.installations_goal || 0)
          )[0] || null;

      const bonusAmount = Number(reachedTarget?.bonus_amount || 0);
      const totalAmount = baseCommissionAmount + bonusAmount;

      return {
        vendor_id: vendor.id,
        year,
        month,
        commission_setting_id: setting.id,
        completed_installations: completedInstallations,
        base_amount_per_installation: baseAmount,
        base_commission_amount: baseCommissionAmount,
        bonus_amount: bonusAmount,
        total_amount: totalAmount,
        payment_status: "pending",
        notes: `Liquidación generada para ${month}/${year}`,
        status: "draft",
        updated_at: nowIso,
      };
    })
    .filter(Boolean);

  if (rows.length === 0) {
    return {
      ok: true,
      period: { year, month },
      totalVendors: 0,
      totalInstallations: 0,
      rows: [],
    };
  }

  // 9) Guardar con upsert
  const { data: savedRows, error: upsertError } = await supabase
    .from("vendor_commissions")
    .upsert(rows, {
      onConflict: "vendor_id,year,month",
    })
    .select();

  if (upsertError) {
    throw new Error(`Error guardando liquidaciones: ${upsertError.message}`);
  }

  return {
    ok: true,
    period: { year, month },
    totalVendors: rows.length,
    totalInstallations: filteredInstallations.length,
    rows: savedRows,
  };
}