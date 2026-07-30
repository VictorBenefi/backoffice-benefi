// @ts-nocheck

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserRole } from "@/lib/get-user-role";
import PeriodSelector from "./period-selector";

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
  notes: string | null;
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
  merchant_id: string | null;
  pos_id: string | null;
  status: string | null;
  install_date: string | null;
  created_at: string;
};

type MerchantRow = {
  id: string;
  name: string | null;
};

type PosRow = {
  id: string;
  code: string | null;
  serial_number: string | null;
};

type VendorCommission = {
  id: string;
  vendor_id: string;
  year: number;
  month: number;
  completed_installations: number;
  base_amount_per_installation: number;
  base_commission_amount: number;
  bonus_amount: number;
  total_amount: number;
  payment_status: string;
  status: string | null;
  closed_at: string | null;
};

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

function formatMoney(value: number | string | null | undefined) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Sin fecha";

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export default async function MisComisionesPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    month?: string;
  }>;
}) {
  const role = await getUserRole();

  if (role !== "vendedor") {
    redirect("/dashboard");
  }

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

  if (!user) {
    redirect("/login");
  }

  const { data: vendorData } = await supabase
    .from("vendors")
    .select("id, name, auth_user_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const vendor = vendorData as VendorRow | null;

  if (!vendor) {
    return (
      <main className="min-h-screen bg-slate-50 p-3 sm:p-4 lg:p-6">
        <div className="mx-auto max-w-5xl rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h1 className="text-lg font-semibold text-amber-950">
            Perfil de vendedor no vinculado
          </h1>

          <p className="mt-2 text-sm leading-6 text-amber-700">
            Tu usuario todavía no está relacionado con un vendedor. Un
            administrador debe completar la vinculación para que puedas
            consultar tus comisiones.
          </p>
        </div>
      </main>
    );
  }

const params = await searchParams;
const today = new Date();

const currentYear = today.getFullYear();
const currentMonth = today.getMonth() + 1;

const { data: availableSettingsData } =
  await supabase
    .from("commission_settings")
    .select(
      "id, year, month, base_amount_per_installation, notes, is_active"
    )
    .order("year", { ascending: false })
    .order("month", { ascending: false });

const availableSettings =
  (availableSettingsData as CommissionSetting[]) ||
  [];

const requestedYear = Number(params.year);
const requestedMonth = Number(params.month);

const requestedPeriodIsValid =
  Number.isInteger(requestedYear) &&
  Number.isInteger(requestedMonth) &&
  requestedMonth >= 1 &&
  requestedMonth <= 12 &&
  availableSettings.some(
    (setting) =>
      Number(setting.year) === requestedYear &&
      Number(setting.month) === requestedMonth
  );

const currentPeriodExists =
  availableSettings.some(
    (setting) =>
      Number(setting.year) === currentYear &&
      Number(setting.month) === currentMonth
  );

const fallbackSetting =
  availableSettings[0] || null;

const year = requestedPeriodIsValid
  ? requestedYear
  : currentPeriodExists
    ? currentYear
    : Number(
        fallbackSetting?.year || currentYear
      );

const month = requestedPeriodIsValid
  ? requestedMonth
  : currentPeriodExists
    ? currentMonth
    : Number(
        fallbackSetting?.month || currentMonth
      );

const periodLabel = `${months[month - 1]} ${year}`;

const monthStart = `${year}-${String(
  month
).padStart(2, "0")}-01`;

const lastDay = new Date(
  year,
  month,
  0
).getDate();

const monthEnd = `${year}-${String(
  month
).padStart(2, "0")}-${String(
  lastDay
).padStart(2, "0")}`;

const selectedSetting =
  availableSettings.find(
    (setting) =>
      Number(setting.year) === year &&
      Number(setting.month) === month
  ) || null;

    const [
    installationsResult,
    savedCommissionResult,
    merchantsResult,
    posResult,
    ] = await Promise.all([
    
    supabase
      .from("installations")
      .select(
        "id, vendor_id, merchant_id, pos_id, status, install_date, created_at"
      )
      .eq("vendor_id", vendor.id)
      .eq("status", "completed")
      .gte("install_date", monthStart)
      .lte("install_date", monthEnd)
      .order("install_date", { ascending: false }),

    supabase
      .from("vendor_commissions")
      .select("*")
      .eq("vendor_id", vendor.id)
      .eq("year", year)
      .eq("month", month)
      .maybeSingle(),

    supabase.from("merchants").select("id, name"),

    supabase.from("pos_devices").select("id, code, serial_number"),
  ]);

  const setting = selectedSetting;

  const installations =
    (installationsResult.data as InstallationRow[]) || [];

  const savedCommission =
    (savedCommissionResult.data as VendorCommission | null) || null;

  const merchants =
    (merchantsResult.data as MerchantRow[]) || [];

  const posDevices =
    (posResult.data as PosRow[]) || [];

  let targets: CommissionTarget[] = [];

  if (setting) {
    const { data } = await supabase
      .from("commission_targets")
      .select("*")
      .eq("commission_setting_id", setting.id)
      .order("installations_goal", { ascending: true });

    targets = (data as CommissionTarget[]) || [];
  }

  const installationsCount = installations.length;

  const baseAmount = Number(
    setting?.base_amount_per_installation || 0
  );

  const estimatedInstallationCommission =
    installationsCount * baseAmount;

  const achievedTargets = targets.filter(
    (target) =>
      installationsCount >= Number(target.installations_goal || 0)
  );

  const achievedTarget =
    [...achievedTargets].sort(
      (a, b) =>
        Number(b.installations_goal) -
        Number(a.installations_goal)
    )[0] || null;

  const objectiveCommission = Number(
    achievedTarget?.bonus_amount || 0
  );

  const nextTarget =
    targets.find(
      (target) =>
        installationsCount <
        Number(target.installations_goal || 0)
    ) || null;

  const missingForNextTarget = nextTarget
    ? Math.max(
        Number(nextTarget.installations_goal) -
          installationsCount,
        0
      )
    : 0;

  const targetProgress = nextTarget
    ? Math.min(
        (installationsCount /
          Number(nextTarget.installations_goal || 1)) *
          100,
        100
      )
    : targets.length > 0
      ? 100
      : 0;

  const processingCommission = 0;

  const estimatedTotal =
    estimatedInstallationCommission +
    objectiveCommission +
    processingCommission;

  const isClosed =
    savedCommission?.status === "closed";

    const periodOptions = availableSettings.map(
    (setting) => ({
        value: `${setting.year}-${setting.month}`,
        label: `${months[setting.month - 1]} ${setting.year}`,
    })
    );

const selectedPeriodValue = `${year}-${month}`;

  const installationCommissionToShow = isClosed
    ? Number(savedCommission?.base_commission_amount || 0)
    : estimatedInstallationCommission;

  const objectiveCommissionToShow = isClosed
    ? Number(savedCommission?.bonus_amount || 0)
    : objectiveCommission;

  const totalToShow = isClosed
    ? Number(savedCommission?.total_amount || 0)
    : estimatedTotal;

  return (
    <main className="min-h-screen min-w-0 overflow-x-hidden bg-slate-50 p-3 sm:p-4 lg:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950 md:text-3xl">
              Mis comisiones
            </h1>

            <p className="mt-1 text-sm leading-6 text-slate-500">
              Consultá tus instalaciones, objetivos y comisiones
              generadas durante el mes.
            </p>
          </div>

          <PeriodSelector
            periods={periodOptions}
            selectedValue={selectedPeriodValue}
            status={isClosed ? "closed" : "estimated"}
            />
        </div>

        

        <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Instalaciones del mes"
            value={String(installationsCount)}
          />

          <SummaryCard
            label="Comisión por instalación"
            value={formatMoney(
              installationCommissionToShow
            )}
          />

          <SummaryCard
            label="Comisión por objetivos"
            value={formatMoney(objectiveCommissionToShow)}
          />

          <SummaryCard
            label="Total del mes"
            value={formatMoney(totalToShow)}
            highlighted
          />
        </section>

        <div className="grid items-start gap-6 xl:grid-cols-2">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <SectionHeader
              title="1. Comisión por instalación"
              description="Se genera por cada instalación completada durante el período."
            />

            <div className="p-4 md:p-5">
              {!setting ? (
                <WarningBox message="No existe una configuración de comisiones para el período actual." />
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <ValueBox
                      label="Instalaciones"
                      value={String(installationsCount)}
                    />

                    <ValueBox
                      label="Valor unitario"
                      value={formatMoney(baseAmount)}
                    />

                    <ValueBox
                      label="Comisión generada"
                      value={formatMoney(
                        installationCommissionToShow
                      )}
                      highlighted
                    />
                  </div>

                  <div className="mt-4 rounded-xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-600">
                      {installationsCount} instalaciones ×{" "}
                      {formatMoney(baseAmount)}
                    </p>

                    <p className="mt-1 font-semibold text-slate-950">
                      Total por instalaciones:{" "}
                      {formatMoney(
                        installationCommissionToShow
                      )}
                    </p>
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <SectionHeader
              title="2. Comisión por objetivos"
              description="Bono adicional por alcanzar los objetivos mensuales configurados."
            />

            <div className="p-4 md:p-5">
              {!setting ? (
                <WarningBox message="No hay una configuración disponible para calcular objetivos." />
              ) : targets.length === 0 ? (
                <WarningBox message="No se configuraron objetivos para el período actual." />
              ) : (
                <>
                  <div className="space-y-3">
                    {targets.map((target) => {
                      const achieved =
                        installationsCount >=
                        Number(target.installations_goal);

                      return (
                        <div
                          key={target.id}
                          className={`flex flex-col gap-2 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
                            achieved
                              ? "border-emerald-200 bg-emerald-50"
                              : "border-slate-200 bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                                achieved
                                  ? "bg-emerald-600 text-white"
                                  : "bg-white text-slate-400"
                              }`}
                            >
                              {achieved ? "✓" : "○"}
                            </div>

                            <div>
                              <p className="font-semibold text-slate-950">
                                {target.installations_goal} instalaciones
                              </p>

                              <p className="mt-0.5 text-xs text-slate-500">
                                Bono correspondiente
                              </p>
                            </div>
                          </div>

                          <p
                            className={`font-bold ${
                              achieved
                                ? "text-emerald-700"
                                : "text-slate-700"
                            }`}
                          >
                            {formatMoney(target.bonus_amount)}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-600">
                        Progreso hacia el próximo objetivo
                      </span>

                      <span className="font-semibold text-slate-950">
                        {Math.round(targetProgress)}%
                      </span>
                    </div>

                    <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all"
                        style={{
                          width: `${targetProgress}%`,
                        }}
                      />
                    </div>
                  </div>

                  {nextTarget ? (
                    <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
                      <p className="text-sm leading-6 text-blue-800">
                        Te faltan{" "}
                        <strong>{missingForNextTarget}</strong>{" "}
                        instalaciones para alcanzar el objetivo de{" "}
                        <strong>
                          {nextTarget.installations_goal}
                        </strong>{" "}
                        y obtener un bono de{" "}
                        <strong>
                          {formatMoney(nextTarget.bonus_amount)}
                        </strong>
                        .
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                      <p className="text-sm font-medium text-emerald-800">
                        Alcanzaste todos los objetivos configurados para
                        este mes.
                      </p>
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-950 p-4 text-white">
                    <span className="text-sm">
                      Bono generado
                    </span>

                    <span className="text-lg font-bold">
                      {formatMoney(objectiveCommissionToShow)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <SectionHeader
            title="3. Comisión por procesamiento"
            description="Porcentaje sobre el volumen procesado por los POS comisionables."
          />

          <div className="p-4 md:p-5">
            <div className="rounded-2xl border border-dashed border-violet-300 bg-violet-50 p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <span className="inline-flex rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                    Próxima etapa
                  </span>

                  <h3 className="mt-3 text-lg font-semibold text-violet-950">
                    Integración con el procesamiento de los POS
                  </h3>

                  <p className="mt-2 max-w-3xl text-sm leading-6 text-violet-700">
                    Cuando se conecte la API de las terminales, aquí
                    podrás consultar el volumen procesado por cada POS,
                    el porcentaje aplicado, la comisión generada y los
                    meses restantes del período comisionable.
                  </p>
                </div>

                <div className="grid min-w-0 gap-2 sm:grid-cols-3 md:min-w-[390px]">
                  <PlaceholderValue label="POS comisionables" />
                  <PlaceholderValue label="Monto procesado" />
                  <PlaceholderValue label="Comisión generada" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <SectionHeader
            title="Instalaciones computadas"
            description="Detalle de las instalaciones consideradas en el período actual."
            badge={`${installations.length} registros`}
          />

          {installations.length === 0 ? (
            <div className="p-4">
              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
                <p className="text-sm text-slate-500">
                  No hay instalaciones completadas durante este mes.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-3 p-4 md:hidden">
                {installations.map((installation) => {
                  const merchant =
                    merchants.find(
                      (item) =>
                        item.id === installation.merchant_id
                    ) || null;

                  const pos =
                    posDevices.find(
                      (item) => item.id === installation.pos_id
                    ) || null;

                  return (
                    <article
                      key={installation.id}
                      className="rounded-xl border border-slate-200 bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-slate-950">
                            {merchant?.name || "Comercio sin identificar"}
                          </h3>

                          <p className="mt-1 text-sm text-slate-500">
                            POS:{" "}
                            {pos?.code ||
                              pos?.serial_number ||
                              "Sin identificación"}
                          </p>
                        </div>

                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          Computada
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <ValueBox
                          label="Fecha"
                          value={formatDate(
                            installation.install_date
                          )}
                        />

                        <ValueBox
                          label="Comisión"
                          value={formatMoney(baseAmount)}
                          highlighted
                        />
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200 text-left">
                      <th className="px-5 py-3 font-medium text-slate-600">
                        Comercio
                      </th>

                      <th className="px-5 py-3 font-medium text-slate-600">
                        POS
                      </th>

                      <th className="px-5 py-3 font-medium text-slate-600">
                        Fecha
                      </th>

                      <th className="px-5 py-3 font-medium text-slate-600">
                        Comisión
                      </th>

                      <th className="px-5 py-3 font-medium text-slate-600">
                        Estado
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {installations.map((installation) => {
                      const merchant =
                        merchants.find(
                          (item) =>
                            item.id === installation.merchant_id
                        ) || null;

                      const pos =
                        posDevices.find(
                          (item) => item.id === installation.pos_id
                        ) || null;

                      return (
                        <tr
                          key={installation.id}
                          className="border-b border-slate-100 last:border-b-0"
                        >
                          <td className="px-5 py-4 font-medium text-slate-950">
                            {merchant?.name ||
                              "Comercio sin identificar"}
                          </td>

                          <td className="px-5 py-4 text-slate-600">
                            {pos?.code ||
                              pos?.serial_number ||
                              "Sin identificación"}
                          </td>

                          <td className="px-5 py-4 text-slate-600">
                            {formatDate(
                              installation.install_date
                            )}
                          </td>

                          <td className="px-5 py-4 font-semibold text-slate-950">
                            {formatMoney(baseAmount)}
                          </td>

                          <td className="px-5 py-4">
                            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                              Computada
                            </span>
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
      className={`min-w-0 rounded-2xl border p-4 shadow-sm ${
        highlighted
          ? "border-blue-200 bg-blue-50"
          : "border-slate-200 bg-white"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p
        className={`mt-2 break-words text-xl font-bold sm:text-2xl ${
          highlighted ? "text-blue-950" : "text-slate-950"
        }`}
      >
        {value}
      </p>
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
  badge?: string;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-start sm:justify-between md:px-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">
          {title}
        </h2>

        <p className="mt-1 text-sm leading-6 text-slate-500">
          {description}
        </p>
      </div>

      {badge ? (
        <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
          {badge}
        </span>
      ) : null}
    </div>
  );
}

function ValueBox({
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
      className={`min-w-0 rounded-xl p-3 ${
        highlighted ? "bg-blue-50" : "bg-slate-50"
      }`}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p
        className={`mt-1 break-words text-sm font-semibold ${
          highlighted ? "text-blue-950" : "text-slate-950"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function WarningBox({
  message,
}: {
  message: string;
}) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm leading-6 text-amber-700">
        {message}
      </p>
    </div>
  );
}

function PlaceholderValue({
  label,
}: {
  label: string;
}) {
  return (
    <div className="flex h-full min-h-[88px] flex-col justify-center rounded-xl bg-white/80 p-3">
      <p className="text-center text-[11px] font-medium uppercase tracking-wide text-violet-400">
        {label}
      </p>

      <p className="mt-2 text-center text-sm font-semibold text-violet-900">
        Pendiente de API
      </p>
            </div>
  );
}