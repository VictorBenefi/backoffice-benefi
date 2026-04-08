// @ts-nocheck
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getUserRole } from "@/lib/get-user-role";

type VendorRow = {
  id: string;
  name: string | null;
  auth_user_id: string | null;
};

type CommissionSetting = {
  id: string;
  year: number;
  month: number;
  base_amount_per_installation: number;
  is_active: boolean;
};

type CommissionTarget = {
  id: string;
  commission_setting_id: string;
  installations_goal: number;
  bonus_amount: number;
};

type InstallationRow = {
  id: string;
  vendor_id: string | null;
  status: string | null;
  install_date: string | null;
  created_at: string;
  merchant_id: string | null;
  pos_id: string | null;
};

export default async function DashboardPage() {
  const role = await getUserRole();
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [posRes, movRes, vendorRes, merchantRes] = await Promise.all([
    supabase.from("pos_devices").select("*"),
    supabase
      .from("pos_movements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.from("vendors").select("*"),
    supabase.from("merchants").select("*"),
  ]);

  const posDevices = posRes.data || [];
  const movements = movRes.data || [];
  const vendors = (vendorRes.data || []) as VendorRow[];
  const merchants = merchantRes.data || [];

  const isVendor = role === "vendedor";
  const dashboardTitle = isVendor ? "Mi Dashboard" : "Dashboard";

 const totalPos = posDevices.length;
const posInStock = posDevices.filter((p) => p.status === "in_stock").length;
const posMaintenance = posDevices.filter(
  (p) => p.status === "maintenance"
).length;
const posInactive = posDevices.filter((p) => p.status === "inactive").length;

// Para este dashboard, "Sin comercio" debe reflejar los POS disponibles en stock,
// excluyendo mantenimiento y excluyendo POS ya asignados a comercios.
const posWithoutMerchant = posDevices.filter(
  (p) => p.status === "in_stock"
).length;

  const vendorCards = [
    { title: "Mis POS", value: totalPos },
    { title: "Mis comercios", value: merchants.length },
    { title: "POS sin comercio", value: posWithoutMerchant },
    { title: "Movimientos recientes", value: movements.length },
  ];

  const adminCards = [
    { title: "Total POS", value: totalPos },
    { title: "En stock", value: posInStock },
    { title: "En mantenimiento", value: posMaintenance },
    { title: "Sin comercio", value: posWithoutMerchant },
  ];

  const cardsToShow = isVendor ? vendorCards : adminCards;

  const posByVendor = vendors.map((vendor) => {
    const count = posDevices.filter(
      (p) => String(p.vendor_id) === String(vendor.id)
    ).length;

    return {
      id: vendor.id,
      name: vendor.name || "Sin nombre",
      count,
    };
  });

  const getMovementLabel = (type: string) => {
    switch (type) {
      case "ingreso_stock":
        return "Ingreso a stock";
      case "asignado_vendedor":
        return "Asignado a vendedor";
      case "asignado_comercio":
        return "Asignado a comercio";
      case "retorno_stock":
        return "Retorno a stock";
      case "mantenimiento":
        return "En mantenimiento";
      case "baja":
        return "Baja";
      case "instalacion_completada":
        return "Instalación completada";
      default:
        return type;
    }
  };

  const getMovementBadgeClass = (type: string) => {
    switch (type) {
      case "ingreso_stock":
        return "bg-emerald-100 text-emerald-700";
      case "asignado_vendedor":
        return "bg-blue-100 text-blue-700";
      case "asignado_comercio":
        return "bg-violet-100 text-violet-700";
      case "retorno_stock":
        return "bg-cyan-100 text-cyan-700";
      case "mantenimiento":
        return "bg-amber-100 text-amber-700";
      case "baja":
        return "bg-rose-100 text-rose-700";
      case "instalacion_completada":
        return "bg-emerald-100 text-emerald-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const vendorsWithoutPos = vendors.filter(
    (vendor) =>
      !posDevices.some((pos) => String(pos.vendor_id) === String(vendor.id))
  );

  const merchantsWithoutPos = merchants.filter(
    (merchant) =>
      !posDevices.some((pos) => String(pos.merchant_id) === String(merchant.id))
  );

  const posAssignedMerchantWithoutVendor = posDevices.filter(
    (pos) => pos.status === "assigned_merchant" && !pos.vendor_id
  );

  let commissionData: {
    installationsCount: number;
    baseAmount: number;
    baseTotal: number;
    nextTarget: CommissionTarget | null;
    progress: number;
    missingForNextTarget: number;
    potentialTotal: number;
    hasTargets: boolean;
  } | null = null;

  if (isVendor && user?.id) {
    const currentVendor = vendors.find(
      (v) => String(v.auth_user_id) === String(user.id)
    );

    if (currentVendor) {
      const today = new Date();
      const currentMonth = today.getMonth() + 1;
      const currentYear = today.getFullYear();

      const monthStart = `${currentYear}-${String(currentMonth).padStart(
        2,
        "0"
      )}-01`;

      const monthEndDate = new Date(currentYear, currentMonth, 0);
      const monthEnd = `${currentYear}-${String(currentMonth).padStart(
        2,
        "0"
      )}-${String(monthEndDate.getDate()).padStart(2, "0")}`;

      const [{ data: config }, { data: installations }] = await Promise.all([
        supabase
          .from("commission_settings")
          .select("*")
          .eq("year", currentYear)
          .eq("month", currentMonth)
          .eq("is_active", true)
          .maybeSingle(),
        supabase
          .from("installations")
          .select("*")
          .eq("vendor_id", currentVendor.id)
          .eq("status", "completed")
          .gte("install_date", monthStart)
          .lte("install_date", monthEnd),
      ]);

      if (config) {
        const typedConfig = config as CommissionSetting;

        const { data: targets } = await supabase
          .from("commission_targets")
          .select("*")
          .eq("commission_setting_id", typedConfig.id)
          .order("installations_goal", { ascending: true });

        const typedTargets = ((targets || []) as CommissionTarget[]).sort(
          (a, b) => a.installations_goal - b.installations_goal
        );

        const typedInstallations = (installations || []) as InstallationRow[];
        const installationsCount = typedInstallations.length;
        const baseAmount = Number(typedConfig.base_amount_per_installation || 0);
        const baseTotal = installationsCount * baseAmount;
        const hasTargets = typedTargets.length > 0;

        let nextTarget: CommissionTarget | null = null;

        for (const target of typedTargets) {
          if (installationsCount < Number(target.installations_goal || 0)) {
            nextTarget = target;
            break;
          }
        }

        const progress = nextTarget
          ? Math.min(
              (installationsCount / Number(nextTarget.installations_goal || 1)) *
                100,
              100
            )
          : 0;

        const missingForNextTarget = nextTarget
          ? Math.max(
              Number(nextTarget.installations_goal || 0) - installationsCount,
              0
            )
          : 0;

        const potentialTotal = nextTarget
          ? baseTotal + Number(nextTarget.bonus_amount || 0)
          : baseTotal;

        commissionData = {
          installationsCount,
          baseAmount,
          baseTotal,
          nextTarget,
          progress,
          missingForNextTarget,
          potentialTotal,
          hasTargets,
        };
      }
    }
  }

  return (
    <main className="h-[calc(100vh-120px)] overflow-hidden bg-gray-50 p-6">
      <div className="flex h-full flex-col overflow-hidden">
        <div className="mb-6 shrink-0">
          <h1 className="text-3xl font-bold">{dashboardTitle}</h1>
        </div>

        <div className="flex-1 overflow-auto pr-2">
          <div className="space-y-8">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">Rol del usuario logueado</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {role || "Sin rol asignado"}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {cardsToShow.map((card) => (
                <div
                  key={card.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <p className="text-sm text-slate-500">{card.title}</p>
                  <p className="mt-3 text-3xl font-bold text-slate-900">
                    {card.value}
                  </p>
                </div>
              ))}
            </div>

            {isVendor && commissionData && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-xl font-semibold">
                  Progreso de comisiones
                </h2>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-sm text-slate-500">
                      Instalaciones del mes
                    </p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">
                      {commissionData.installationsCount}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-sm text-slate-500">
                      Base por instalación
                    </p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">
                      ${commissionData.baseAmount.toLocaleString("es-AR")}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-sm text-slate-500">
                      Comisión acumulada
                    </p>
                    <p className="mt-2 text-3xl font-bold text-emerald-600">
                      ${commissionData.baseTotal.toLocaleString("es-AR")}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-sm text-slate-500">Próximo objetivo</p>
                    <p className="mt-2 text-2xl font-bold text-blue-600">
                      {!commissionData.hasTargets
                        ? "Sin objetivos"
                        : commissionData.nextTarget
                        ? `${commissionData.nextTarget.installations_goal} instalaciones`
                        : "Objetivos cumplidos"}
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
                    <span>Progreso hacia el próximo objetivo</span>
                    <span>{Math.round(commissionData.progress)}%</span>
                  </div>

                  <div className="h-4 w-full rounded-full bg-slate-200">
                    <div
                      className="h-4 rounded-full bg-blue-600 transition-all"
                      style={{ width: `${commissionData.progress}%` }}
                    />
                  </div>
                </div>

                {!commissionData.hasTargets ? (
                  <div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-700">
                    No hay objetivos configurados para el período activo.
                  </div>
                ) : commissionData.nextTarget ? (
                  <div className="mt-5 rounded-xl bg-blue-50 p-4 text-sm text-slate-700">
                    <p>
                      Te faltan{" "}
                      <span className="font-bold">
                        {commissionData.missingForNextTarget}
                      </span>{" "}
                      instalaciones para alcanzar el objetivo de{" "}
                      <span className="font-bold">
                        {commissionData.nextTarget.installations_goal}
                      </span>{" "}
                      y sumar un bono de{" "}
                      <span className="font-bold text-emerald-700">
                        $
                        {Number(
                          commissionData.nextTarget.bonus_amount || 0
                        ).toLocaleString("es-AR")}
                      </span>
                      .
                    </p>

                    <p className="mt-2">
                      Total potencial al alcanzar ese objetivo:{" "}
                      <span className="font-bold text-slate-900">
                        $
                        {commissionData.potentialTotal.toLocaleString("es-AR")}
                      </span>
                    </p>
                  </div>
                ) : (
                  <div className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">
                    Ya alcanzaste todos los objetivos configurados para este mes.
                  </div>
                )}
              </section>
            )}

            {!isVendor && (
              <section>
                <h2 className="mb-4 text-xl font-semibold">
                  Alertas operativas
                </h2>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm text-slate-500">POS en stock</p>
                    <p className="mt-3 text-3xl font-bold text-emerald-600">
                      {posInStock}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm text-slate-500">En mantenimiento</p>
                    <p className="mt-3 text-3xl font-bold text-amber-600">
                      {posMaintenance}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm text-slate-500">
                      Sin comercio asignado
                    </p>
                    <p className="mt-3 text-3xl font-bold text-red-600">
                      {posWithoutMerchant}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm text-slate-500">POS inactivos</p>
                    <p className="mt-3 text-3xl font-bold text-slate-600">
                      {posInactive}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {!isVendor && (
              <section>
                <h2 className="mb-4 text-xl font-semibold">
                  Alertas inteligentes
                </h2>

                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="flex h-[320px] flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-semibold">Vendedores sin POS</h3>
                      <span className="rounded-full bg-rose-100 px-3 py-1 text-sm font-bold text-rose-700">
                        {vendorsWithoutPos.length}
                      </span>
                    </div>

                    <div className="flex-1 overflow-auto pr-1">
                      {vendorsWithoutPos.length === 0 ? (
                        <p className="text-sm text-slate-500">Sin alertas.</p>
                      ) : (
                        <div className="space-y-2">
                          {vendorsWithoutPos.map((vendor) => (
                            <div
                              key={vendor.id}
                              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                            >
                              {vendor.name || "Sin nombre"}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex h-[320px] flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-semibold">Comercios sin POS</h3>
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-700">
                        {merchantsWithoutPos.length}
                      </span>
                    </div>

                    <div className="flex-1 overflow-auto pr-1">
                      {merchantsWithoutPos.length === 0 ? (
                        <p className="text-sm text-slate-500">Sin alertas.</p>
                      ) : (
                        <div className="space-y-2">
                          {merchantsWithoutPos.map((merchant) => (
                            <div
                              key={merchant.id}
                              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                            >
                              {merchant.name || "Sin nombre"}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex h-[320px] flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-semibold">
                        POS en comercio sin vendedor
                      </h3>
                      <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-bold text-violet-700">
                        {posAssignedMerchantWithoutVendor.length}
                      </span>
                    </div>

                    <div className="flex-1 overflow-auto pr-1">
                      {posAssignedMerchantWithoutVendor.length === 0 ? (
                        <p className="text-sm text-slate-500">Sin alertas.</p>
                      ) : (
                        <div className="space-y-2">
                          {posAssignedMerchantWithoutVendor.map((pos) => (
                            <div
                              key={pos.id}
                              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                            >
                              {pos.code || "Sin código"}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}

            <div className="grid gap-6 xl:grid-cols-2">
              {!isVendor && (
                <section className="flex h-[420px] flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-xl font-semibold">
                    POS por vendedor
                  </h2>

                  <div className="flex-1 overflow-auto pr-1">
                    {posByVendor.length === 0 ? (
                      <p className="text-gray-500">
                        No hay vendedores cargados.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {posByVendor.map((v) => (
                          <div
                            key={v.id}
                            className="flex items-center justify-between border-b border-slate-200 pb-2"
                          >
                            <p className="text-sm font-medium text-slate-700">
                              {v.name}
                            </p>
                            <span className="text-sm font-bold text-slate-900">
                              {v.count} POS
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              )}

              <section
                className={`flex h-[420px] flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${
                  isVendor ? "xl:col-span-2" : ""
                }`}
              >
                <h2 className="mb-4 text-xl font-semibold">
                  {isVendor ? "Mis últimos movimientos" : "Últimos movimientos"}
                </h2>

                <div className="flex-1 overflow-auto pr-1">
                  {movements.length === 0 ? (
                    <p className="text-gray-500">
                      No hay movimientos recientes.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {movements.map((mov) => (
                        <div
                          key={mov.id}
                          className="rounded-xl border border-slate-200 p-4"
                        >
                          <div className="mb-2 flex items-center gap-3">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getMovementBadgeClass(
                                mov.type
                              )}`}
                            >
                              {getMovementLabel(mov.type)}
                            </span>
                          </div>

                          <p className="text-sm text-slate-600">
                            {mov.notes || "Sin detalle"}
                          </p>

                          <p className="mt-2 text-xs text-slate-400">
                            {new Date(mov.created_at || "").toLocaleString(
                              "es-AR"
                            )}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}