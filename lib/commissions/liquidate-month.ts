import { createAdminClient } from "@/lib/supabase/admin";

type LiquidateMonthParams = {
  year: number;
  month: number; // 1 a 12
};

function getMonthRange(year: number, month: number) {
  const from = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const to = new Date(Date.UTC(year, month, 1, 0, 0, 0)); // siguiente mes
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

export async function liquidateMonth({ year, month }: LiquidateMonthParams) {
  const supabase = createAdminClient();

  const { from, to } = getMonthRange(year, month);

  // 1) Buscar configuración del mes
  // Ajustá este query a tu esquema real si commission_settings usa otros campos
  const { data: setting, error: settingError } = await supabase
    .from("commission_settings")
    .select("id, year, month, base_amount_per_installation")
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  if (settingError) {
    throw new Error(`Error buscando configuración de comisión: ${settingError.message}`);
  }

  if (!setting) {
    throw new Error(`No existe commission_settings para ${month}/${year}`);
  }

  // 2) Buscar objetivos del setting
  const { data: targets, error: targetsError } = await supabase
    .from("commission_targets")
    .select("id, commission_setting_id, installations_required, bonus_amount")
    .eq("commission_setting_id", setting.id)
    .order("installations_required", { ascending: true });

  if (targetsError) {
    throw new Error(`Error buscando objetivos: ${targetsError.message}`);
  }

  // 3) Traer vendedores
  const { data: vendors, error: vendorsError } = await supabase
    .from("vendors")
    .select("id, name")
    .order("name", { ascending: true });

  if (vendorsError) {
    throw new Error(`Error buscando vendedores: ${vendorsError.message}`);
  }

  // 4) Traer instalaciones completed del mes
  const { data: installations, error: installationsError } = await supabase
    .from("installations")
    .select("id, vendor_id, installed_at, created_at, status")
    .eq("status", "completed")
    .gte("installed_at", from)
    .lt("installed_at", to);

  if (installationsError) {
    throw new Error(`Error buscando instalaciones: ${installationsError.message}`);
  }

  // Si en tu tabla no usás installed_at y usás created_at, cambiá el filtro arriba.

  // 5) Contar instalaciones por vendedor
  const installationCountByVendor = new Map<string, number>();

  for (const row of installations ?? []) {
    const vendorId = row.vendor_id;
    if (!vendorId) continue;

    installationCountByVendor.set(
      vendorId,
      (installationCountByVendor.get(vendorId) ?? 0) + 1
    );
  }

  // 6) Construir liquidaciones
  const rows = (vendors ?? []).map((vendor) => {
    const completedInstallations = installationCountByVendor.get(vendor.id) ?? 0;
    const baseAmount = Number(setting.base_amount_per_installation ?? 0);
    const baseCommissionTotal = completedInstallations * baseAmount;

    const achievedTarget =
      [...(targets ?? [])]
        .filter((t) => completedInstallations >= Number(t.installations_required ?? 0))
        .sort(
          (a, b) =>
            Number(b.installations_required ?? 0) - Number(a.installations_required ?? 0)
        )[0] ?? null;

    const bonusAmount = Number(achievedTarget?.bonus_amount ?? 0);
    const totalCommission = baseCommissionTotal + bonusAmount;

    return {
      vendor_id: vendor.id,
      year,
      month,
      commission_setting_id: setting.id,
      completed_installations: completedInstallations,
      base_amount_per_installation: baseAmount,
      base_commission_total: baseCommissionTotal,
      bonus_amount: bonusAmount,
      total_commission: totalCommission,
      liquidated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  // 7) Upsert
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
    totalInstallations: installations?.length ?? 0,
    rows: savedRows,
  };
}